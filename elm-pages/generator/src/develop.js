const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");
const path = require("path");
const HTMLWebpackPlugin = require("html-webpack-plugin");
const ScriptExtHtmlWebpackPlugin = require("script-ext-html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const PrerenderSPAPlugin = require("prerender-spa-plugin");
const merge = require("webpack-merge");
const { InjectManifest } = require("workbox-webpack-plugin");
const FaviconsWebpackPlugin = require("favicons-webpack-plugin");
const AddFilesPlugin = require("./add-files-plugin.js");
const ImageminPlugin = require("imagemin-webpack-plugin").default;
const imageminMozjpeg = require("imagemin-mozjpeg");
const express = require("express");
const ClosurePlugin = require("closure-webpack-plugin");
const readline = require("readline");

module.exports = { start, run };
function start({
  routes,
  debug,
  customPort,
  manifestConfig,
  routesWithRequests,
  filesToGenerate,
  executablePath
}) {
  const config = webpackOptions(false, routes, {
    debug,
    manifestConfig,
    routesWithRequests,
    filesToGenerate,
    executablePath
  });

  const compiler = webpack(config);

  const options = {
    contentBase: false,
    hot: true,
    inline: true,
    host: "localhost",
    stats: "errors-only",
    publicPath: "/"
  };

  const app = express();

  app.use("/images", express.static(path.resolve(process.cwd(), "./images")));

  app.use(require("webpack-dev-middleware")(compiler, options));
  app.use(
    require("webpack-hot-middleware")(compiler, {
      log: console.log,
      path: "/__webpack_hmr"
    })
  );

  app.use("*", function(req, res, next) {
    // don't know why this works, but it does
    // see: https://github.com/jantimon/html-webpack-plugin/issues/145#issuecomment-170554832
    const filename = path.join(compiler.outputPath, "index.html");
    compiler.outputFileSystem.readFile(filename, function(err, result) {
      if (err) {
        return next(err);
      }
      res.set("content-type", "text/html");
      res.send(result);
      res.end();
    });
  });

  const port = customPort || 3000;
  app.listen(port, () =>
    console.log(`🚀 elm-pages develop on http://localhost:${port}`)
  );
  // https://stackoverflow.com/questions/43667102/webpack-dev-middleware-and-static-files
  // app.use(express.static(__dirname + "/path-to-static-folder"));
}

function run(
  {
    routes,
    manifestConfig,
    routesWithRequests,
    filesToGenerate,
    executablePath
  },
  callback
) {
  webpack(
    webpackOptions(true, routes, {
      debug: false,
      manifestConfig,
      routesWithRequests,
      filesToGenerate,
      executablePath
    })
  ).run((err, stats) => {
    if (err) {
      console.error(err);
      process.exit(1);
    } else {
      callback();
    }

    console.log(
      stats.toString({
        chunks: false, // Makes the build much quieter
        colors: true, // Shows colors in the console
        // copied from `'minimal'`
        all: false,
        modules: false,
        performance: true,
        timings: false,
        outputPath: true,
        maxModules: 0,
        errors: true,
        warnings: true,
        // our additional options
        moduleTrace: false,
        errorDetails: false
      })
    );

    const duration = roundToOneDecimal(
      (stats.endTime - stats.startTime) / 1000
    );
    console.log(`Duration: ${duration}s`);
  });
}

function roundToOneDecimal(n) {
  return Math.round(n * 10) / 10;
}

function printProgress(progress, message) {
  readline.clearLine(process.stdout);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`${progress} ${message}`);
}
function webpackOptions(
  production,
  routes,
  { debug, manifestConfig, routesWithRequests, filesToGenerate, executablePath }
) {
  const common = {
    mode: production ? "production" : "development",
    plugins: [
      new AddFilesPlugin(routesWithRequests, filesToGenerate),
      new CopyPlugin([
        {
          from: "static/**/*",
          transformPath(targetPath, absolutePath) {
            // TODO this is a hack... how do I do this with proper config of `to` or similar?
            return targetPath.substring(targetPath.indexOf("/") + 1);
          }
        }
      ]),
      new CopyPlugin([
        {
          from: "images/",
          to: "images/"
        }
      ]),
      new ImageminPlugin({
        test: /\.(jpe?g|png|gif|svg)$/i,
        cacheFolder: path.resolve(process.cwd(), "./.cache"),
        disable: !production,
        pngquant: {
          quality: "50-70",
          speed: 7
        },
        plugins: [
          imageminMozjpeg({
            quality: 75,
            progressive: false
          })
        ]
      }),

      new HTMLWebpackPlugin({
        inject: "head",
        template: path.resolve(__dirname, "template.html")
      }),
      new ScriptExtHtmlWebpackPlugin({
        preload: /\.js$/,
        defaultAttribute: "defer"
      }),
      new FaviconsWebpackPlugin({
        logo: path.resolve(process.cwd(), `./${manifestConfig.sourceIcon}`),
        favicons: {
          path: "/", // Path for overriding default icons path. `string`
          appName: manifestConfig.name, // Your application's name. `string`
          appShortName: manifestConfig.short_name, // Your application's short_name. `string`. Optional. If not set, appName will be used
          appDescription: manifestConfig.description, // Your application's description. `string`
          developerName: null, // Your (or your developer's) name. `string`
          developerURL: null, // Your (or your developer's) URL. `string`
          dir: "auto", // Primary text direction for name, short_name, and description
          lang: "en-US", // Primary language for name and short_name
          background: manifestConfig.background_color, // Background colour for flattened icons. `string`
          theme_color: manifestConfig.theme_color, // Theme color user for example in Android's task switcher. `string`
          appleStatusBarStyle: "black-translucent", // Style for Apple status bar: "black-translucent", "default", "black". `string`
          display: manifestConfig.display, // Preferred display mode: "fullscreen", "standalone", "minimal-ui" or "browser". `string`
          orientation: manifestConfig.orientation, // Default orientation: "any", "natural", "portrait" or "landscape". `string`
          scope: manifestConfig.serviceworker.scope, // set of URLs that the browser considers within your app
          start_url: manifestConfig.start_url, // Start URL when launching the application from a device. `string`
          version: "1.0", // Your application's version string. `string`
          logging: true, // Print logs to console? `boolean`
          pixel_art: false, // Keeps pixels "sharp" when scaling up, for pixel art.  Only supported in offline mode.
          loadManifestWithCredentials: false, // Browsers don't send cookies when fetching a manifest, enable this to fix that. `boolean`
          icons: {
            // Platform Options:
            // - offset - offset in percentage
            // - background:
            //   * false - use default
            //   * true - force use default, e.g. set background for Android icons
            //   * color - set background for the specified icons
            //   * mask - apply mask in order to create circle icon (applied by default for firefox). `boolean`
            //   * overlayGlow - apply glow effect after mask has been applied (applied by default for firefox). `boolean`
            //   * overlayShadow - apply drop shadow after mask has been applied .`boolean`
            //
            android: true, // Create Android homescreen icon. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
            appleIcon: true, // Create Apple touch icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
            appleStartup: false, // Create Apple startup images. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
            coast: false, // Create Opera Coast icon. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
            favicons: true, // Create regular favicons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
            firefox: false, // Create Firefox OS icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
            windows: false, // Create Windows 8 tile icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
            yandex: false // Create Yandex browser icon. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }`
          }
        }
      }),
      new InjectManifest({
        swSrc: path.resolve(__dirname, "./service-worker-template.js"),
        // don't include index.html and main.js in pre-cache because it was causing stale data for some users
        // include: [/^index\.html$/, /main\.js$/],
        include: [],
        exclude: [
          /android-chrome-.*\.png$/,
          /apple-touch-icon.*\.png/,
          /assets\//
        ],
        swDest: "service-worker.js"
      })
      // comment this out to do performance profiling
      // (drag-and-drop `events.json` file into Chrome performance tab)
      // , new webpack.debug.ProfilingPlugin()
    ],
    output: {
      publicPath: "/"
    },
    resolve: {
      modules: [
        path.resolve(process.cwd(), `./node_modules`),
        // TODO: find a cleaner way to do this.
        // This line just needs a way to point to the `node_modules` directory
        // for the library bin (not the user's node_modules, which is the
        // process.cwd prefixed node_modules above).
        path.resolve(path.dirname(require.resolve("webpack")), "../../")
      ],
      extensions: [".js", ".elm", ".scss", ".png", ".html"]
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: require.resolve("babel-loader")
          }
        },
        {
          test: /\.scss$/,
          exclude: [/elm-stuff/],
          // see https://github.com/webpack-contrib/css-loader#url
          loaders: [
            require.resolve("style-loader"),
            require.resolve("css-loader"),
            require.resolve("sass-loader")
          ]
        },
        {
          test: /\.css$/,
          exclude: [/elm-stuff/],
          loaders: [
            require.resolve("style-loader"),
            require.resolve("css-loader")
          ]
        },
        {
          test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          exclude: [/elm-stuff/, /node_modules/],
          loader: require.resolve("file-loader")
        }
      ]
    }
  };
  if (production) {
    return merge(common, {
      entry: "./index.js",
      optimization: {
        minimizer: [
          new ClosurePlugin(
            { mode: "STANDARD" },
            {
              // compiler flags here
              //
              // for debuging help, try these:
              //
              // formatting: 'PRETTY_PRINT'
              // debug: true,
              // renaming: false
            }
          )
        ]
      },
      plugins: [
        new webpack.ProgressPlugin({
          entries: true,
          modules: true,
          modulesCount: 100,
          profile: true,
          handler: (percentage, message, ...args) => {
            printProgress(`${Math.floor(percentage * 100)}%`, message);
          }
        }),
        new PrerenderSPAPlugin({
          staticDir: path.join(process.cwd(), "dist"),
          routes: routes,
          renderer: new PrerenderSPAPlugin.PuppeteerRenderer({
            renderAfterDocumentEvent: "prerender-trigger",
            executablePath: executablePath
          })
        })
      ],
      module: {
        rules: [
          {
            test: /\.elm$/,
            exclude: [/elm-stuff/, /node_modules/],
            use: {
              loader: require.resolve("elm-webpack-loader"),
              options: {
                optimize: true
              }
            }
          }
        ]
      }
    });
  } else {
    return merge(common, {
      entry: [require.resolve("webpack-hot-middleware/client"), "./index.js"],
      plugins: [
        new webpack.NamedModulesPlugin(),
        // Prevents compilation errors causing the hot loader to lose state
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.HotModuleReplacementPlugin()
      ],
      module: {
        rules: [
          {
            test: /\.elm$/,
            exclude: [/elm-stuff/, /node_modules/],
            use: [
              { loader: require.resolve("elm-hot-webpack-loader") },
              {
                loader: require.resolve("elm-webpack-loader"),
                options: {
                  debug: debug,
                  forceWatch: true
                }
              }
            ]
          }
        ]
      }
    });
  }
}
