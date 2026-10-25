const LAMBDA_NAME_SUFFIXES = [
  "-process-document",
  "-task-runner",
  "-cron-trigger",
  "-email-processor",
  "-auto-top-up",
] as const;

function normalizeLambdaIdentifier(value?: string | null): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function getDefaultExtractLambdaFunctionName(
  appFlavor = process.env.NEXT_PUBLIC_APP_FLAVOR
): string {
  switch (appFlavor) {
    case "doc-vision":
      return "doc-vision-process-document";
    default:
      return "zdocs-process-document";
  }
}

export function getExtractLambdaFunctionName(
  lambdaFunctionName = process.env.AWS_EXTRACT_LAMBDA_FUNCTION_NAME,
  appFlavor = process.env.NEXT_PUBLIC_APP_FLAVOR
): string {
  return (
    normalizeLambdaIdentifier(lambdaFunctionName) ||
    getDefaultExtractLambdaFunctionName(appFlavor)
  );
}

export function getLambdaEnvironmentPrefix(
  lambdaIdentifier?: string | null
): string {
  const normalizedIdentifier = normalizeLambdaIdentifier(lambdaIdentifier);

  if (!normalizedIdentifier) {
    return "zdocs";
  }

  const functionName =
    normalizedIdentifier.split(":function:").pop() || normalizedIdentifier;

  for (const suffix of LAMBDA_NAME_SUFFIXES) {
    if (functionName.endsWith(suffix)) {
      return functionName.slice(0, -suffix.length);
    }
  }

  return functionName;
}

export function getQueueRetryScheduleName(
  lambdaIdentifier?: string | null
): string {
  return `${getLambdaEnvironmentPrefix(lambdaIdentifier)}-queue-retry-next`;
}
