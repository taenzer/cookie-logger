import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const common = {
    bundle: true,
    sourcemap: true,
    target: ['chrome120']
};

await Promise.all([
    esbuild.build({
        ...common,
        entryPoints: ['src/background/**/*'],
        outdir: 'dist/src/background',
        format: 'esm',
        platform: 'browser',

    }),

    esbuild.build({
        ...common,
        entryPoints: ['src/content/**/*'],
        outdir: 'dist/src/content',
        format: 'iife',
        platform: 'browser',

    }),
    esbuild.build({
        ...common,
        entryPoints: ['src/popup/popup.ts'],
        outfile: 'dist/src/popup/popup.js',
        format: 'iife',
        platform: 'browser',
    })
]);
