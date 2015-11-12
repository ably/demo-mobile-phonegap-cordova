module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    concat: {
      options: {
        separator: ';',
      },
      vendor: {
        src: ['www/js/vendor/*.js'],
        dest: 'www/js/compiled/vendor.js',
      },
      app: {
        src: ['www/js/*.js'],
        dest: 'www/js/compiled/app.js',
      },
    },

    // Convert SCSS to CSS
    sass: {
        dist: {
            files: {
                "www/css/style.css" : "www/scss/style.scss"
            }
        }

    },

    // Watch task config
    watch: {
      sass: {
        files: [
            "www/js/*.js",
            "www/js/vendor.js",
            "www/**/*.scss",
            "www/**/*.html",
            "www/**/*.json",
        ],
        tasks: [ 'sass', 'concat' ]
      }
    },

    // Simple web server
    nodestatic: {
      server: {
        options: {
          port: process.env.PORT || 4000,
          base: 'www',
          keepalive: true
        }
      },

      watch: {
        options: {
          port: 4000,
          base: 'www'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-nodestatic');

  grunt.registerTask('build', ['sass', 'concat']);
  grunt.registerTask('watch:server', ['build', 'nodestatic:watch', 'watch']);
  grunt.registerTask('server', ['build', 'nodestatic:server']);

  grunt.registerTask('default', ['build']);
};
