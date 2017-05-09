const db = require('../data/nedb');
const router = require('express').Router();
const speakingUrl = require('speakingurl');

router.route('/')
  .get(function(req, res) {
      return db.pages.find(req.query).then(function(docs) {
          return res.json(docs);
      }, function(err) {
          return res.json(err);
      });
  })
  .post(function(req, res) {
    if(!req.body.parent) {
      req.body.parent = 'root';
    }

    return db.pages.findOne({_id: req.body.parent}).then(function(parentDoc) {
      req.body.path = parentDoc.path ? parentDoc.path + ',' + parentDoc._id : parentDoc._id;
      req.body.slug = speakingUrl(req.body.name);
      req.body.url = parentDoc.url + '/' + req.body.slug;
      return db.pages.insert(req.body).then(function(newDoc) {
        return res.json(newDoc);
      }, function(err) {
        return res.json(err);
      });
    }, function(err) {
      return res.json(err);
    });
  });

router.route('/:id')
  .get(function(req, res) {
    return db.pages.findOne({_id: req.params.id}).then(function(doc) {
      return res.json(doc);
    }, function(err) {
      return res.json(err);
    });
  })
  .put(function(req, res) {
    if(req.body.parent || req.body.name) {
      return db.pages.findOne({_id: req.params.id}).then(function(page) {
        return Promise.all([
          db.pages.findOne({_id: (req.body.parent ? req.body.parent : page.parent)}),
          db.pages.find({path: {$regex: new RegExp(req.params.id)}})
        ]).then(function(results) {
          let parent = results[0];
          let descendants = results[1];

          page.parent = parent._id;
          page.path = parent._id != 'root' ? parent.path + ',' + parent._id : parent._id;
          page.name = req.body.name ? req.body.name : page.name;
          page.slug = speakingUrl(page.name);
          page.url = parent.url + '/' + page.slug;
          page.properties = req.body.properties ? req.body.properties : page.properties;

          descendants.sort(function(a,b) {
            return a.path.split(',').length - b.path.split(',').length;
          });

          for(let i in descendants) {
            let descendant = descendants[i];
            let descendantParent = null;
            if(descendant.parent == page._id) {
              descendantParent = page;
            } else {
              for(let p in descendants) {
                if(descendants[p]._id == descendant.parent) {
                  descendantParent = descendants[p];
                  break;
                }
              }
            }
            descendant.path = descendantParent.path + ',' + descendantParent._id;
            descendant.url = descendantParent.url + '/' + descendant.slug;
          }

          var updates = [];

          updates.push(db.pages.update(
            {_id: page._id},
            {
              $set: {
                parent: page.parent,
                path: page.path,
                name: page.name,
                slug: page.slug,
                url: page.url,
                properties: page.properties
              }
            },
            {
              returnUpdatedDocs: true
            }
          ));

          for(let i in descendants) {
            updates.push(db.pages.update(
              {_id: descendants[i]._id},
              {
                $set: {
                  path: descendants[i].path,
                  url: descendants[i].url
                }
              }
            ));
          }

          return Promise.all(updates).then(function(results) {
            return res.json(results[0]);
          }, function(err) {
            return res.json(err);
          });
        }, function(err) {
          return res.json(err);
        });
      }, function(err) {
        return res.json(err);
      })
    } else {
      return db.pages.update({_id: req.params.id}, { $set: { properties: req.body.properties } }, {returnUpdatedDocs: true }).then(function(updatedPage) {
        return res.json(updatedPage);
      }, function(err) {
        return res.json(err);
      })
    }
  });

module.exports = router;
