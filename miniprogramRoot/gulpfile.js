/*
 * @Author: your name
 * @Date: 2021-08-18 09:44:44
 * @LastEditTime: 2021-08-31 17:27:06
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \宝姐珠宝\miniprogramRoot\gulpfile.js
 */
const gulp = require('gulp');
const path = require('path');
const del = require('del');
const changed = require('gulp-changed');
const gulpTs = require('gulp-typescript');
const gulpIf = require('gulp-if');
const sourcemaps = require('gulp-sourcemaps');
const gulpLess = require('gulp-less');
const rename = require('gulp-rename');
const gulpImage = require('gulp-imagemin');
const cache = require('gulp-cache');
const mpNpm = require('gulp-mp-npm');
const tsAlias = require('gulp-ts-alias');
const weappAlias = require('gulp-wechat-weapp-src-alisa');
const tap = require('gulp-tap');
// const cssFilterFiles = require("./config/cssFilterFiles.js");
const pump = require('pump');
const uglifyjs = require('uglify-js');
const composer = require('gulp-uglify/composer');
const minify = composer(uglifyjs, console);
// const configTask = require("./config/task/index");
const prettyData = require('gulp-pretty-data');
const gulpI18nWxml = require('@miniprogram-i18n/gulp-i18n-wxml');
const gulpI18nLocales = require('@miniprogram-i18n/gulp-i18n-locales');
// const filter = require('gulp-filter');

const resolve = (...args) => path.resolve(__dirname, ...args);

/* config */
const src = './src';
const dist = './dist';

// 默认dev配置
let config = {
  sourcemap: {
    ts: true, // 是否开启 ts sourcemap
    less: true // 是否开启 less sourcemap
  },
  compress: false // 是否压缩wxml、json、less等各种文件
};

// 设置成build配置
const setBuildConfig = (cb) => {
  config = {
    sourcemap: {
      ts: false, // 是否开启 ts sourcemap
      less: false // 是否开启 less sourcemap
    },
    compress: true
  };
  cb();
};

// options
const srcOptions = { base: src };
const watchOptions = { events: ['add', 'change'] };
const mpNpmOptions = { npmDirname: 'miniprogram_npm' };
const weappAliasConfig = {
  '@': path.join(__dirname, './src')
};
const minifyOptions = {
  compress: {
    drop_console: false,
    drop_debugger: true
  }
};

// 文件匹配路径
const globs = {
  // ts: [`${src}/**/*.ts`, "./typings/index.d.ts"], // 匹配 ts 文件
  ts: [`${src}/**/*.ts`], // 匹配 ts 文件
  js: `${src}/**/*.js`, // 匹配 js 文件
  json: `${src}/**/*.json`, // 匹配 json 文件
  less: `${src}/**/*.less`, // 匹配 less 文件
  wxss: `${src}/**/*.wxss`, // 匹配 wxss 文件
  image: `${src}/**/*.{png,jpg,jpeg,gif,svg}`, // 匹配 image 文件
  wxml: `${src}/**/*.wxml`, // 匹配 wxml 文件
  i18n: `${src}/**/i18n/*.json`, // 国际化配置文件
  md: `${src}/**/*.md` // 匹配 md 文件
};
globs.copy = [
  `${src}/**`,
  `!${globs.ts[0]}`,
  `!${globs.ts[1]}`,
  `!${globs.js}`,
  `!${globs.json}`,
  `!${globs.less}`,
  `!${globs.wxss}`,
  `!${globs.image}`,
  `!${globs.wxml}`,
  `!${globs.md}`
]; // 匹配需要拷贝的文件

// 包装 gulp.lastRun, 引入文件 ctime 作为文件变动判断另一标准
// https://github.com/gulpjs/vinyl-fs/issues/226
const since = (task) => (file) => (gulp.lastRun(task) > file.stat.ctime ? gulp.lastRun(task) : 0);

/** `gulp clear`
 * 清理文件
 * */
const clear = () => del(dist);

/** `gulp clearCache`
 * 清理缓存
 * */
const clearCache = () => cache.clearAll();

/** `gulp copy`
 * 清理
 * */
const copy = () => gulp
  .src(globs.copy, { ...srcOptions, since: since(copy) })
  .pipe(changed(dist)) // 过滤掉未改变的文件
  .pipe(gulp.dest(dist));

/**
 * gulp ts
 * 编译ts
 * */
// const filterTsFilePath = ['**/*.js'];
const tsEmptyFilePath = [];
// const filterEmptyTsFile = filter(filterTsFilePath, { restore: true });
const tsProject = gulpTs.createProject(resolve('tsconfig.json'));
const ts = (cb) => {
  const tsResult = gulp
    .src(globs.ts, { ...srcOptions, since: since(ts) })
    .pipe(tsAlias({ configuration: tsProject.config }))
    .pipe(gulpIf(config.sourcemap.ts, sourcemaps.init()))
    .pipe(tsProject()) // 编译ts
    .on('error', () => {});

  pump(
    [
      tsResult.js,
      mpNpm(mpNpmOptions),
      tap((file) => {
        const content = file.contents.toString();
        if (content.length < 78) {
          // ts文件编译成js文件后，无依赖的空文件,内容清空
          // filterTsFilePath.push(`!${file.path}`);
          // file.contents = Buffer.from('', 'utf8'); // 清空内容
          // 空文件路径存储
          tsEmptyFilePath.push(file.path);
        }
      }),
      // filterEmptyTsFile, // 无依赖的空文件不参与sourcemaps和压缩
      gulpIf(config.sourcemap.ts, sourcemaps.write('.')),
      gulpIf(config.compress, minify(minifyOptions)),
      // filterEmptyTsFile.restore,
      gulp.dest(dist)
    ],
    cb
  );
};

/** `gulp js`
 * 解析js
 * */
const js = () => gulp
  .src(globs.js, { ...srcOptions, since: since(js) })
  .pipe(mpNpm(mpNpmOptions)) // 分析依赖
  .pipe(gulp.dest(dist));

/** `gulp json`
 * 解析json
 * */
const json = () => gulp
  .src(globs.json, { ...srcOptions, since: since(json) })
  .pipe(mpNpm(mpNpmOptions)) // 分析依赖
  .pipe(
    gulpIf(
      config.compress,
      prettyData({
        type: 'minify',
        preserveComments: true
      })
    )
  )
  .pipe(gulp.dest(dist));

/** `gulp less`
 * 编译less
 * */
// const filterLessFilePath = ['**/*.css'];
// const filterEmptyLessFile = filter(filterLessFilePath, { restore: false });
const less = (cb) => {
  pump(
    [
      gulp.src(globs.less, { ...srcOptions, since: since(less) }),
      gulpIf(config.sourcemap.less, sourcemaps.init()),
      weappAlias(weappAliasConfig),
      tap((file) => {
        const content = file.contents.toString();
        const commentReg = /\/\*(\s|.)*?\*\//g; // 消除 段落注释 正则
        const matchImportReg = /@import\s+['|"](.+)['|"];/g; // 匹配 @import 正则
        const noCommentStr = content.replace(commentReg, '');
        const str = noCommentStr.replace(matchImportReg, ($1, $2) => {
        //   const hasFilter = cssFilterFiles.filter(
        //     (item) => $2.indexOf(item) > -1
        //   );
        //   let path = hasFilter <= 0 ? `/** less: ${$1} **/` : $1;
          let path = $1
          return path;
        });
        file.contents = Buffer.from(str, 'utf8');
      }),
      gulpLess(),
      tap((file) => {
        const content = file.contents.toString();
        const matchImportCommentReg = /\/\*\* less: @import\s+['|"](.+)['|"]; \*\*\//g;
        const matchImportReg = /@import\s+['|"](.+)['|"];/g;
        const commentReg = /\/\*(\s|.)*?\*\//g; // 消除 段落注释 正则
        const str = content.replace(matchImportCommentReg, ($1, $2) => {
          let less = '';
          $1.replace(matchImportReg, ($3) => { less = $3 });
          return less.replace(/\.less/g, '.wxss');
        });
        const noCommentStr = str.replace(commentReg, ''); // 消除注释
        // if (noCommentStr.length < 6) {
        //   // 查找出空的css文件
        //   filterLessFilePath.push(`!${file.path}`);
        // }
        file.contents = Buffer.from(noCommentStr, 'utf8');
      }),
      // filterEmptyLessFile, // 过滤掉空的css文件
      rename({ extname: '.wxss' }),
      mpNpm(mpNpmOptions),
      // gulpIf(config.sourcemap.less, sourcemaps.write(".")),
      gulpIf(
        config.compress,
        prettyData({
          type: 'minify',
          extensions: {
            wxss: 'css'
          }
        })
      ),
      gulp.dest(dist)
    ],
    cb
  );
};

/** `gulp wxss`
 * 解析wxss
 * */
const wxss = () => gulp
  .src(globs.wxss, { ...srcOptions, since: since(wxss) })
  .pipe(mpNpm(mpNpmOptions)) // 分析依赖
  .pipe(
    gulpIf(
      config.compress,
      prettyData({
        type: 'minify',
        extensions: {
          wxss: 'css'
        }
      })
    )
  )
  .pipe(gulp.dest(dist));

/** `gulp image`
 * 压缩图片
 * */
const image = () => gulp
  .src(globs.image, { ...srcOptions, since: since(image) })
  .pipe(cache(gulpImage()))
  .pipe(gulp.dest(dist));

/** `gulp wxml`
 * 解析wxml
 * */
const wxml = () => gulp
  .src(globs.wxml, { ...srcOptions, since: since(wxml) })
  .pipe(
    gulpIf(
      config.compress,
      prettyData({
        type: 'minify',
        extensions: {
          wxml: 'xml'
        }
      })
    )
  )
  .pipe(gulp.dest(dist));

/**
 * 输出空ts文件路径
 * */
const logEmptyTsFilePath = async () => {
  if (tsEmptyFilePath.length) {
    const translatedTsEmptyFilePath = tsEmptyFilePath.map((item) => {
      return item.match(/miniprogram(\S*)/)[1].replace('.js', '.ts');
    });
    await console.log(
      '\n================ 温馨提示 ================\n以下',
      translatedTsEmptyFilePath.length,
      '个ts文件编译后为空文件，\n1. 如果是纯类型定义文件，请修改文件后缀为.d.ts;\n2. 如果是空文件，请及时删除;\n\n',
      translatedTsEmptyFilePath,
      '\n=========================================\n'
    );
  }
};
/**
 * 国际化，复制国际化文件到dist
 */
const mergeAndGenerateLocales = () => {
  return gulp
    .src(globs.i18n)
    .pipe(gulpI18nLocales({ defaultLocale: 'zh-CN', fallbackLocale: 'zh-CN' }))
    .pipe(gulp.dest(dist + '/i18n/'));
};

/**
 * 国际化，遍历所有wxml，进行转换复制到dist
 */
const transpileWxml = () => {
  return gulp.src(globs.wxml).pipe(gulpI18nWxml()).pipe(gulp.dest(dist));
};

/** `gulp build`
 * 构建
 * */
const _build = gulp.parallel(copy, ts, js, json, less, wxss, image, wxml);
const build = gulp.series(
  setBuildConfig,
  gulp.parallel(clear, clearCache),
  _build,
  logEmptyTsFilePath,
  // mergeAndGenerateLocales,
  // transpileWxml,
  // configTask.configTask
);

/** `gulp watch`
 * 监听
 * */
const watch = () => {
  gulp.watch(globs.copy, watchOptions, copy);
  gulp.watch(globs.ts, watchOptions, ts);
  gulp.watch(globs.js, watchOptions, js);
  gulp.watch(globs.json, watchOptions, json);
  gulp.watch(globs.less, watchOptions, less);
  gulp.watch(globs.wxss, watchOptions, wxss);
  gulp.watch(globs.image, watchOptions, image);
  gulp.watch(globs.wxml, watchOptions, wxml);
};

/** `gulp` or `gulp dev`
 * 构建并监听
 * */
const dev = gulp.series(
  clear,
  _build,
  logEmptyTsFilePath,
  // configTask.configTask,
  watch
);

// `gulp --tasks` list tasks
module.exports = {
  copy,
  ts,
  js,
  json,
  less,
  wxss,
  image,
  wxml,
  clear,
  clearCache,
  build,
  watch,
  dev,
  default: dev
};
