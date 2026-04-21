import { supabase } from './supabaseClient';

const FUNCTION_NAME =
  process.env.REACT_APP_AI_ASSISTANT_FUNCTION || 'informational-ai-assistant';

const TOKEN_EXPIRY_BUFFER_MS = 120000;

const sanitizeHistory = (history) => {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .map((entry) => ({
      role: entry?.role === 'assistant' ? 'assistant' : 'user',
      content: String(entry?.content || '').trim(),
    }))
    .filter((entry) => Boolean(entry.content));
};

const getSessionFromAuth = async () => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || 'Unable to validate your session. Please sign in again.');
  }

  return session;
};

const isTokenExpiring = (session, bufferMs = TOKEN_EXPIRY_BUFFER_MS) => {
  const accessToken = String(session?.access_token || '').trim();
  if (!accessToken) return true;

  const expiresAtMs = Number(session?.expires_at || 0) * 1000;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return false;

  return expiresAtMs - Date.now() <= bufferMs;
};

const refreshSessionOrNull = async () => {
  const refresh = await supabase.auth.refreshSession();
  if (refresh?.error || !refresh?.data?.session?.access_token) {
    return null;
  }

  return refresh.data.session;
};

const getValidSession = async ({ forceRefresh = false } = {}) => {
  const session = await getSessionFromAuth();
  const shouldRefresh = forceRefresh || isTokenExpiring(session);

  if (shouldRefresh) {
    const refreshedSession = await refreshSessionOrNull();
    if (!refreshedSession) {
      throw new Error('Your session has expired. Please sign in again.');
    }
    return refreshedSession;
  }

  return session;
};

const invokeAssistant = ({ accessToken, cleanMessage, history }) =>
  supabase.functions.invoke(FUNCTION_NAME, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: {
      message: cleanMessage,
      history: sanitizeHistory(history),
    },
  });

const readFunctionContextMessage = async (context) => {
  if (!context) return '';

  const parseText = (responseText) => {
    const raw = String(responseText || '').trim();
    if (!raw) return '';

    try {
      const parsed = JSON.parse(raw);
      return String(parsed?.error || parsed?.message || raw).trim();
    } catch {
      return raw;
    }
  };

  try {
    if (typeof context.clone === 'function') {
      const cloned = context.clone();
      const clonedText = await cloned.text();
      const parsed = parseText(clonedText);
      if (parsed) return parsed;
    }
  } catch {
    // Fall through to direct context body read.
  }

  try {
    const directText = await context.text();
    return parseText(directText);
  } catch {
    return '';
  }
};

const isLikelyAuthFailure = ({ statusCode, message }) => {
  const normalized = String(message || '').toLowerCase();
  const hasUnsupportedTokenAlgorithm =
    normalized.includes('unsupported jwt algorithm') ||
    normalized.includes('unsupported token algorithm');

  if (hasUnsupportedTokenAlgorithm) return false;

  if (statusCode === 401 || statusCode === 403) return true;

  return (
    normalized.includes('invalid jwt') ||
    normalized.includes('jwt expired') ||
    normalized.includes('missing authorization') ||
    normalized.includes('unauthorized')
  );
};

const mapAssistantProviderFailureMessage = (message) => {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return '';

  const isQuotaError =
    normalized.includes('quota exceeded') ||
    normalized.includes('rate limit') ||
    normalized.includes('limit: 0') ||
    normalized.includes('exceeded your current quota');

  if (isQuotaError) {
    return 'AI assistant is temporarily unavailable due to provider quota limits. Please try again in a minute.';
  }

  const isHighDemandError =
    normalized.includes('high demand') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('please try again later');

  if (isHighDemandError) {
    return 'AI assistant is currently experiencing high demand. Please try again shortly.';
  }

  return '';
};

const extractFunctionError = async (error) => {
  let detailedMessage =
    String(error?.details || '').trim() ||
    String(error?.error?.message || '').trim() ||
    String(error?.message || '').trim() ||
    'Unable to contact the AI assistant.';
  const statusCode = Number(error?.context?.status || error?.status || 0);

  try {
    const contextMessage = await readFunctionContextMessage(error?.context);
    if (contextMessage) {
      detailedMessage = contextMessage;
    }
  } catch {
    // Keep fallback message when response payload cannot be parsed.
  }

  if (Number.isFinite(statusCode) && statusCode > 0) {
    detailedMessage = `Assistant request failed (${statusCode}): ${detailedMessage}`;
  }

  const providerFriendlyMessage = mapAssistantProviderFailureMessage(detailedMessage);
  if (providerFriendlyMessage) {
    detailedMessage = providerFriendlyMessage;
  }

  return {
    statusCode,
    detailedMessage,
  };
};

export async function requestInformationalAssistant({ message, history = [] }) {
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    throw new Error('Message cannot be empty.');
  }

  const session = await getValidSession();

  let { data, error } = await invokeAssistant({
    accessToken: session.access_token,
    cleanMessage,
    history,
  });

  if (error) {
    const extracted = await extractFunctionError(error);
    const shouldRetryAuth = isLikelyAuthFailure({
      statusCode: extracted.statusCode,
      message: extracted.detailedMessage,
    });

    if (shouldRetryAuth) {
      try {
        const refreshedSession = await getValidSession({ forceRefresh: true });
        const retryResult = await invokeAssistant({
          accessToken: refreshedSession.access_token,
          cleanMessage,
          history,
        });

        data = retryResult.data;
        error = retryResult.error;
      } catch {
        throw new Error('Your session has expired. Please sign in again before using the AI assistant.');
      }
    }

    if (error) {
      const retryExtracted = await extractFunctionError(error);

      // Recovery fallback: retry once with an empty history on 5xx responses.
      // This avoids hard failures caused by malformed/oversized conversation context.
      if (retryExtracted.statusCode >= 500 && Array.isArray(history) && history.length > 0) {
        const fallbackResult = await invokeAssistant({
          accessToken: session.access_token,
          cleanMessage,
          history: [],
        });

        if (!fallbackResult.error && fallbackResult.data?.reply) {
          return {
            kind: fallbackResult.data.kind || 'answer',
            reply: String(fallbackResult.data.reply).trim(),
          };
        }

        if (fallbackResult.error) {
          const fallbackExtracted = await extractFunctionError(fallbackResult.error);
          throw new Error(fallbackExtracted.detailedMessage);
        }
      }

      throw new Error(retryExtracted.detailedMessage);
    }
  }

  if (!data?.reply) {
    throw new Error('AI assistant returned an empty response.');
  }

  return {
    kind: data.kind || 'answer',
    reply: String(data.reply).trim(),
  };
}
