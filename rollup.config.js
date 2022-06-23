import nodeResolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import babel from 'rollup-plugin-babel';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import commonjs from 'rollup-plugin-commonjs';
import { visualizer } from 'rollup-plugin-visualizer';
import ignore from './rollup-plugins/ignore';
import { ignoreTextfieldFiles } from './elements/ignore/textfield';
import { ignoreSelectFiles } from './elements/ignore/select';
import { ignoreSwitchFiles } from './elements/ignore/switch';


const plugins = [
    nodeResolve(),
    commonjs({
        include: 'node_modules/**',
    }),
    typescript(),
    json(),
    babel({
        exclude: 'node_modules/**',
    }),
    visualizer(),
    terser(),
    ignore({
        files: [...ignoreTextfieldFiles, ...ignoreSelectFiles, ...ignoreSwitchFiles].map((file) => require.resolve(file)),
        }),
];

export default [
  {
    input: 'src/wiser-schedule-card.ts',
    output: {
      dir: 'dist',
      format: 'iife',
      sourcemap: false,
    },
    plugins: [...plugins],
        context: 'window',
  },
];