var fs = require('fs');
const axios = require('axios');
const util = require('./util');
var mongo = require('mongodb').MongoClient;
const assert = require('assert');
const url = "mongodb+srv://:@cluster0-vdt7y.mongodb.net/test?retryWrites=true&w=majority";

module.exports = class GraphQuery {

    constructor(cities){
        //console.log(cities[0].toLowerCase(), cities);
        this.jsonAr=[];
        this.b={};
        this.re = 0;
        this.next = true;
        this.cursor = null;
        this.cities = cities;
        this.country = cities[0].toLowerCase();
        this.key = '';
        this.per = 10;
        this.num = 6;

        this.query = `
        query {
          search(type: USER, query:"%s sort:followers-desc", first:%s, after:%s) {
            edges {
              node {
                __typename
                ... on User {
                  login,
                  avatarUrl(size: 72),
                  name,
                  company,
                  location,
                  organizations(first: 1) {
                    nodes {
                      login
                    }
                  }
                  followers {
                    totalCount
                  }
                  contributionsCollection {
                    contributionCalendar {
                      totalContributions
                    }
                  }
                }
              }
            }
             pageInfo {
                endCursor
                hasNextPage
              }
          }
        }`;

    }

    request(){
        if (!(this.re < this.num)){
            this.next = false;
        } else {
            this.re = this.re + 1;
        }
        //console.log(this.re);
        if(this.next) {
            axios
                .create({
                    baseURL: 'https://api.github.com/graphql',
                    headers: {
                        Authorization: `bearer `  + this.key + ``
                    },
                })
                .post('', {
                    query: util.parse(this.query, util.locations(this.cities), this.per, this.cursor)
                })
                .then(({data}) => {
                    //console.log(data);
                    var jsonStr = data.data.search.edges;
                    var jsonAr = this.jsonAr;
                    this.cursor = "\"" + data.data.search.pageInfo.endCursor + "\"";
                    this.next = data.data.search.pageInfo.hasNextPage;

                    Object.keys(jsonStr).forEach(function (index, key) {
                        if (jsonStr[key].node.__typename === "User") {
                            // "__typename": "User",
                            //console.log(key, jsonStr[key].node.__typename, jsonStr[key].node.login, jsonStr[key].node.name, jsonStr[key].node.followers.totalCount);
                            var b = {
                                'id': key,
                                'avatar_url': jsonStr[key].node.avatarUrl,
                                'login': jsonStr[key].node.login,
                                'name': jsonStr[key].node.name,
                                'location': jsonStr[key].node.location,
                                'followers': jsonStr[key].node.followers.totalCount,
                                'contribution': jsonStr[key].node.contributionsCollection.contributionCalendar.totalContributions
                            };
                            jsonAr.push(b);
                        } else {
                            //console.log(jsonStr[key].node.__typename);
                        }
                    });
                    this.request();
                })
                .catch(function () {
                    console.log(util.getDateTime() + " Error occurred in axios response");
                });
        } else {
            var data  = {
                country: this.country,
                dataset: this.jsonAr,
                modified: util.getDateTime()
        };
           mongo.connect(url, {useUnifiedTopology: true}, function(err, client) {
                assert.equal(null, err);
                const collection = client.db("database").collection("countries");
                collection.updateOne(
                    {_country: data.country},
                    {$set:data},
                    {upsert: true})
                    .then(function(result) {
                    // process result
                    client.close();
                });
            });

            console.log(util.getDateTime() + " The file is saved!" + util.locations(this.cities));
        }
        util.check_file(this.path);
    }
};
