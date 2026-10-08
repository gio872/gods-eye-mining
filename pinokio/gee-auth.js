module.exports = {
  run: [
    {
      method: 'shell.run',
      params: {
        path: '..',
        message: 'node scripts/earthengine-auth.mjs',
        env: {
          GEM_EARTHENGINE_PROJECT: '{{env.GEM_EARTHENGINE_PROJECT || ""}}',
        },
      },
    },
  ],
};
