// Application Dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const methodOverride = require('method-override');
const path = require('path');
const { client } = require('./helpers/pgClient');
const { getDataFromAPI } = require('./helpers/superAgentClient');
const { dbExcecute } = require('./helpers/pgClient');
const { Article } = require('./store');

/* ---------- Application Setups ---------- */

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(methodOverride('_method'));
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.use(express.static('./public'));
app.use(express.urlencoded({ extended: true }));

/* --------- Application start the server --------- */

//Test Page (Home)
app.get('/test', (req, res, next) => {
  return res.send('Hello There');
});

//Routes
app.get('/', homeHandler);
app.get('/aboutUs', aboutUsHandler);
app.get('/:category', categoryHandler);
app.get('/article/:id', articleHandler);

//Admin routes
app.get('/admin/login', loginHandler);
app.get('/admin/dashboard', adminDashboardHandler);
app.get('/admin/article/new', adminNewArticleHandler);
app.post('/admin/article/new', adminCreateNewArticleHandler);
app.delete('/admin/article/:id', adminDeleteArticleHandler);

/* --------- Functions Handling routes --------- */

function homeHandler(req, res, next) {
  let key = process.env.CATEGORY_KEY;

  let worldURL = `https://api.nytimes.com/svc/topstories/v2/world.json?api-key=${key}`;
  let artsURL = `https://api.nytimes.com/svc/topstories/v2/arts.json?api-key=${key}`;
  let scienceURL = `https://api.nytimes.com/svc/topstories/v2/science.json?api-key=${key}`;
  let healthURL = `https://api.nytimes.com/svc/topstories/v2/health.json?api-key=${key}`;
  
  getDataFromAPI(worldURL).then((worldData) => {
    let worldArray = worldData.results.slice(0, 5).map((item) => {
      return new Article({ ...item, section: worldData.section });
    });

    getDataFromAPI(artsURL)
      .then((artsData) => {
        let artsArray = artsData.results.slice(0, 5).map((item) => {
          return new Article({ ...item, section: artsData.section });
        });

        getDataFromAPI(scienceURL).then((scienceData) => {
          let scienceArray = scienceData.results.slice(0, 5).map((item) => {
            return new Article({ ...item, section: scienceData.section });
          });

          getDataFromAPI(healthURL).then((healthData) => {
            let healthArray = healthData.results.slice(0, 5).map((item) => {
              return new Article({ ...item, section: healthData.section });
            });
            res.send({
              data1: worldArray,
              data2: artsArray,
              data3: scienceArray,
              data4: healthArray,
            });
          });
        });
      })
      .catch((e) => next(e));
  });
}

/* --------- Admin Handling routes --------- */

function loginHandler(req, res, next) {
  res.render('pages/admin/login');
}

function adminNewArticleHandler(req, res, next) {
  let categorySqlQuery = 'SELECT * FROM category';

  dbExcecute(categorySqlQuery)
    .then(categories => {
      res.render('pages/admin/article', { categories: categories });
    })
    .catch((e) => next(e));
}

function adminCreateNewArticleHandler(req, res, next) {
  let articleData = req.body;

  let sqlQuery = 'INSERT INTO article (title, image, content, published_date, category_id) VALUES ($1, $2, $3, $4, $5);';
  let safeValues = [articleData.title, articleData.image, articleData.content, new Date(), articleData.category];

  dbExcecute(sqlQuery, safeValues)
    .then(res.redirect('/admin/dashboard'))
    .catch(e => next(e));
}

function adminDeleteArticleHandler(req, res, next) {
  let articleId = req.params.id;
  let sqlQuery = 'DELETE FROM article WHERE id = $1;';
  console.log('delte artcile')
  dbExcecute(sqlQuery, [articleId])
    .then(res.redirect('/admin/dashboard'))
    .catch(e => next(e));
}

function aboutUsHandler(req,res){
  res.render('pages/aboutUs');
}

function articleHandler(req, res, next) { //article
  let SQL1 = `SELECT * From article JOIN category ON article.category_id = category.id WHERE article.id= $1;`;
  let safeValues1 = [req.params.id];
  client.query(SQL1, safeValues1)
    .then(result => {
      let article = result.rows[0];
      let category = result.rows[0].name;
      let CATEGORY_KEY = process.env.CATEGORY_KEY;
      let categoryUrl = `https://api.nytimes.com/svc/topstories/v2/${category}.json?api-key=${CATEGORY_KEY}`;
      getDataFromAPI(categoryUrl)
        .then(categoryData => {
          let arr = categoryData.results.slice(0, 6).map((val) => {
            return new Article({ ...val, section: categoryData.section });
          });
          console.log(arr);
          res.render('pages/article', {articleData: article, articleCategory: arr});
        })
        .catch((e) => next(e));
    })
    .catch((e) => next(e));
}

function adminDashboardHandler(req, res, next) {
  let category_name = req.query.category ? [req.query.category] : [];

  let sqlQuery = 'SELECT * FROM article;';
  if (req.query.category) {
    sqlQuery =
      'SELECT * FROM article JOIN category ON article.category_id = category.id WHERE name = $1;';
  }

  dbExcecute(sqlQuery, category_name)
    .then((articles) => {
      let categorySqlQuery = 'SELECT * FROM category';
      dbExcecute(categorySqlQuery)
        .then(categories => {
          res.render('pages/admin/dashboard', { articles: articles, categories: categories });
        })
        .catch((e) => next(e));
    })
    .catch((e) => next(e));
}


//Category Page
function categoryHandler(req, res, next) {

  let categoryName = req.params.category;
  let category_API_KEY = process.env.CATEGORY_KEY;
  let categoryUrl = `https://api.nytimes.com/svc/topstories/v2/${categoryName}.json?api-key=${category_API_KEY}`;

  getDataFromAPI(categoryUrl)
    .then(categoryData => {

      let arr = categoryData.results.map((val) => {
        return new Article({ ...val, section: categoryData.section });
      });

      let sqlQuery = 'SELECT * FROM article JOIN category ON article.category_id = category.id WHERE name = $1'
      let safeValues = [categoryName]
      client.query(sqlQuery, safeValues)
        .then(data => {

          let resultDb = data.rows;

          res.render('pages/category', { categoryApi: arr, categoryDB: resultDb });

        })
    })
    .catch((error) => {
      res.send(error);
    });
}

client
  .connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Listening on PORT ${PORT}`);
    });
  })
  .catch((e) => console.log(e));
