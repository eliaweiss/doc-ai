import type { UIMessage, UIMessagePart } from "ai";

export { cn } from "./utils/cn";

// AI SDK message part utilities

export const getAiPartToolName = (part: UIMessagePart<any, any>) => {
  return part?.type?.split("-")[1];
};

export const isAiPartToolCall = (part: UIMessagePart<any, any>) => {
  return part?.type?.startsWith("tool-");
};

export const getAiMsgToolInvocationPart = (msg: UIMessage) => {
  return msg?.parts?.filter((part: UIMessagePart<any, any>) =>
    isAiPartToolCall(part)
  );
};

export const getAiMsgText = (message: UIMessage) => {
  let text = "";
  if (message && message.parts) {
    for (const part of message.parts) {
      if (part.type === "text" && part.text) {
        text = part.text;
        break;
      }
    }
  }
  return text;
};

interface ZFetchOptions extends Omit<RequestInit, "body"> {
  body?: object;
}

/**
 * Wrapper around fetch that handles JSON serialization and error handling.
 * - Automatically stringifies body
 * - Sets Content-Type to application/json
 * - Throws an error if the response is not ok
 * - Returns parsed JSON response
 */
export async function zFetch(
  url: string,
  options: ZFetchOptions = {}
): Promise<any> {
  const { body, ...restOptions } = options;

  const fetchOptions: RequestInit = {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...restOptions.headers,
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error ||
        errorData.message ||
        `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}
