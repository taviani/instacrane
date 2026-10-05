const { loadProjectEnv } = require('@expo/env');

loadProjectEnv(__dirname, { silent: true });

module.exports = ({ config }) => {
  const owner = process.env.EXPO_OWNER?.trim();
  const projectId = process.env.EXPO_PROJECT_ID?.trim();
  const extra = { ...(config.extra || {}) };
  const eas =
    extra.eas && typeof extra.eas === 'object' && !Array.isArray(extra.eas) ? { ...extra.eas } : {};
  delete eas.projectId;
  if (projectId) eas.projectId = projectId;
  extra.eas = eas;

  const next = { ...config, extra };
  delete next.owner;
  if (owner) next.owner = owner;
  return next;
};
