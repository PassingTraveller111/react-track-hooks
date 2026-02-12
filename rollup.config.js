import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
    // 打包代码（生成 CJS 和 ESM 两种格式）
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/index.cjs.js',
                format: 'cjs', // CommonJS 格式
                sourcemap: true
            },
            {
                file: 'dist/index.esm.js',
                format: 'es', // ES 模块格式
                sourcemap: true
            }
        ],
        plugins: [
            resolve(),
            commonjs(),
            typescript({ tsconfig: './tsconfig.json' })
        ],
        // 外部依赖（不打包进库，由使用方提供）
        external: ['react', 'react-dom']
    },
    // 打包类型声明文件
    {
        input: 'dist/index.d.ts',
        output: [{ file: 'dist/index.d.ts', format: 'es' }],
        plugins: [dts()]
    }
];