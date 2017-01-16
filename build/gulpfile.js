const path = require('path');
const gulpif = require('gulp-if');
const gulp = require("gulp");
const sprite = require("./worf-sprite/index")
var config = {
    outPut: "G:/rjs/guagua/h5/admin/trunk/dist",
    src: "G:/rjs/guagua/h5/admin/trunk/src"
}
gulp.task('img', () => {
    const src = config.src + "/**/*.+(jpeg|jpg|png|gif|ico)";
    return gulp.src(src)
        .pipe(gulp.dest(config.outPut))
});
gulp.task('css', ['img'], () => {

    const src = config.src + "/**/*.css";

    return gulp.src(src)
        .pipe(sprite({
            src: config.src,
            outPut: config.outPut,
            unit: 'rem',
            relativePath: "img/sprite"
        }))
        .pipe(gulp.dest(config.outPut));
});

const clean = require('gulp-clean');
gulp.task('clean', () => {
    return gulp.src([config.outPut], { read: false })
        .pipe(clean({ force: true }));
});

gulp.task('default', ['clean'], () => {
    return gulp.start('css');
});
gulp.start("default");