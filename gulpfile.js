
const gulp = require('gulp')
  , concat = require('gulp-concat')
  , sourcemaps = require('gulp-sourcemaps')
  , uglify = require('gulp-uglify')
  ;

gulp.task('js', function () {
  return gulp.src('jquery.mechounter.js')
    .pipe(sourcemaps.init())
      .pipe(concat('jquery.mechounter.min.js'))
      .pipe(uglify())
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest('.'));
});

gulp.task('default', ['js'], function (cb) {
  cb();
});
