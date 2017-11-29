'use strict';

const faker = require('faker');
const mongoose = require('mongoose');
const chai = require('chai');
const chaiHttp = require('chai-http');

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

const should = chai.should();
chai.use(chaiHttp);

function seedBlogPostData() {
  console.info('seeding blog post data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogPostData());
  }

  return BlogPost.insertMany(seedData);
}

function generateBlogPostData () {
  return {
    title: faker.lorem.words(),
    content: faker.lorem.sentence(),
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
    created: faker.date.recent()
  };
}

function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('Blog API resource', function() {
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogPostData();
  });

  afterEach(function(){
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  describe('GET endpoint', function() {
    
    it('it should return all existing blog posts', function() {
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          res = _res;
          res.body.should.have.length.of.at.least(1);
          return BlogPost.count();
        })
        .then(function(count){
          res.body.should.have.length.of(count);
        });
    });

    it('should return blog posts with the right fields', function() {

      let resPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);

          res.body.forEach(function(post) {
            post.should.be.a('object');
            post.should.include.keys(
              'id', 'title', 'author', 'content');
          });
          resPost = res.body[0];
          return BlogPost.findById(resPost.id);
        })
        .then(function(post) {
          resPost.id.should.equal(post.id);
          resPost.title.should.equal(post.title);
          resPost.content.should.equal(post.content);
          resPost.author.should.equal(`${post.author.firstName} ${post.author.lastName}`);
          // resPost.created.should.equal(post.created);
        });
    });  
  });

  describe('POST endpoint', function() {
    it('should add a new blog post', function() {
      
      const newPost =  generateBlogPostData();

      return chai.request(app)
        .post('/posts')
        .send(newPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.a('object');
          res.body.should.include.keys(
            'id', 'author', 'content', 'title');
          res.body.title.should.equal(newPost.title);
          res.body.id.should.not.be.null;
          res.body.content.should.equal(newPost.content);
          res.body.author.should.equal(`${newPost.author.firstName} ${newPost.author.lastName}`);

          return BlogPost.findById(res.body.id);
        })
        .then(function(post) {
          post.title.should.equal(newPost.title);
          post.author.firstName.should.equal(newPost.author.firstName);
          post.author.lastName.should.equal(newPost.author.lastName);
          post.content.should.equal(newPost.content);
          post.id.should.not.be.null;
        });
    });
  });

  describe('PUT endpoint', function() {
    it('should update fields you send over', function() {
      const updateData = {
        title: 'Updated Blog Post',
        content: 'The quick brown fox jumped over the lazy dog'
      };

      return BlogPost
        .findOne()
        .then(function(post) {
          updateData.id = post.id;

          return chai.request(app)
            .put(`/posts/${post.id}`)
            .send(updateData);
        })
        .then(function(res) {
          res.should.have.status(204);

          return BlogPost.findById(updateData.id);
        })
        .then (function(post) {
          post.title.should.equal(updateData.title);
          post.content.should.equal(updateData.content);
        });
    });
  });

  describe('DELETE endpoint', function() {
    it('delete a post by id', function() {

      let post;

      return BlogPost
        .findOne()
        .then(function(_post) {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(function(_post) {
          should.not.exist(_post);
        });
    });
  });
});
