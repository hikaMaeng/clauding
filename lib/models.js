import { createInterface } from 'node:readline/promises';

/** Validate one legacy-shaped model entry. */
export function validateConfig(config, location) {
  const baseUrl = typeof config?.baseUrl === 'string' ? config.baseUrl.trim() : '';
  if (!URL.canParse(baseUrl) || !['http:', 'https:'].includes(new URL(baseUrl).protocol)) {
    throw new Error(`Set baseUrl to an absolute HTTP or HTTPS URL in ${location}`);
  }
  if (typeof config.model !== 'string' || !config.model.trim()) {
    throw new Error(`Set model to a non-empty model ID in ${location}`);
  }
  if (config.contextTokens != null &&
      (!Number.isSafeInteger(config.contextTokens) || config.contextTokens < 1)) {
    throw new Error(`Set contextTokens to a positive integer in ${location}`);
  }
  if (config.authToken != null && typeof config.authToken !== 'string') {
    throw new Error(`Set authToken to a string in ${location}`);
  }
}

/** Resolve an explicit index or an unambiguous model ID. */
function resolveSelection(models, selector) {
  if (/^\d+$/.test(selector)) {
    const index = Number(selector) - 1;
    if (Number.isSafeInteger(index) && index >= 0 && index < models.length) return models[index];
    throw new Error(`Model index must be between 1 and ${models.length}.`);
  }
  const matches = models.filter((entry) => entry.model.trim() === selector);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Model ID "${selector}" occurs more than once. Select its numeric index.`);
  }
  throw new Error(`Unknown model selection "${selector}". Use a listed index or model ID.`);
}

/** Display an endpoint without URL credentials, query values, or fragments. */
function endpointLabel(baseUrl) {
  const url = new URL(baseUrl.trim());
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

/** Select a legacy config or one entry from the models wrapper. */
export async function selectModel(config, location, selector, input = process.stdin, output = process.stderr) {
  const wrapped = config != null && typeof config === 'object' && Object.hasOwn(config, 'models');
  const models = wrapped ? config.models : [config];
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error(`Set models to a non-empty array in ${location}`);
  }
  models.forEach((entry, index) => validateConfig(entry, wrapped ? `${location} models[${index}]` : location));
  if (selector != null) return resolveSelection(models, selector);
  if (models.length === 1) return models[0];
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Multiple models are configured. Use --select-model <index|model-id> before the folder for non-interactive runs.');
  }

  output.write('Configured models\n');
  models.forEach((entry, index) => {
    const name = entry.model.trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
    output.write(`  ${index + 1}. ${name} @ ${endpointLabel(entry.baseUrl)}\n`);
  });
  const picker = createInterface({ input, output });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  picker.once('close', cancel);
  picker.once('SIGINT', cancel);
  try {
    const answer = await picker.question('Select model [1]: ', { signal: controller.signal });
    return resolveSelection(models, answer.trim() || '1');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Model selection cancelled.');
    throw error;
  } finally {
    picker.removeListener('close', cancel);
    picker.removeListener('SIGINT', cancel);
    picker.close();
  }
}
