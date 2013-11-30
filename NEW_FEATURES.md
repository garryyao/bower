## Work with AMD loaders

## What's the problem

AMD Loaders like `requirejs` and `curl` are not aware of the bower packages, thus there is always a one last mile between
installing a bower package and eventually load it on page, it's always a tedious and error-prune thing to manually update
the AMD loader configuration file every time with install bower package.

## How does that work

The new extened `bower install` command will fill in this gap, it helps to update the AMD loader package definition file you
specified from your local .bowerrc file. Suppose that you're using `requirejs` loader with the following config file:

```js
 require.config({
     packages: [
         {
             name: "when",
             location: "bower_components/when",
             main: "when.js"
         },
         {
             name: "jquery",
             location: "bower_components/jquery",
             main: "jquery.js"
         },
         {
             name: "poly",
             location: "bower_components/poly",
             main: "poly.js"
         }
     ],
     ...
 });

```

You'll new to tell bower where your config file is, by adding the following line to `.bowerrc`:

```
{
    # The above file path relative to your bower working copy.
    "requirejs-config": "config.js"
}
```

Now install any new bower package as regular, e.g.
```
bower install moment
```

Now you requirejs configuration file should look like:
```
 require.config({
     packages: [
         {
             name: "when",
             location: "bower_components/when",
             main: "when.js"
         },
         {
             name: "jquery",
             location: "bower_components/jquery",
             main: "jquery.js"
         },
         {
             name: "poly",
             location: "bower_components/poly",
             main: "poly.js"
         }
         // AUTOMATICALLY ADDED BY BOWER
         {
             name: "moment",
             location: "bower_components/moment",
             main: "moment.js"
         }
     ],
     ...
 });

```
Bower added the new package entry to the list with both `location` and `main` file configured out.
It always try the best to guess what's the most likely single main file for this package. But it doesn't always
succeed, when more than one files are available in the package which are ambitious, in such case, bower will throw out a warning
of what package is missing a main file thus you're able to fix it on your own.


If you have just happened to mangle the packages definitions, and just want to keep up-to-date with the existing bower
components without having to perform `bower install` again, you can just issue the `plant` command:

```
bower plant requirejs
```

By specifying the AMD vendor, the above command will simply align your configuration file with whatever you have in bower.
