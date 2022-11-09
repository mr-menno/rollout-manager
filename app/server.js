const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');

let app = express();
let _START = new Date();

console.log('Release for commit ' + process.env.COMMIT);
//https://kubernetes-client.github.io/javascript/classes/appsv1api.appsv1api-1.html#patchnamespaceddaemonset
console.log('Authorization: Bearer '+process.env.AUTHORIZATION);

app.listen(process.env.PORT||3000, () => {
  console.log('rollout-mgr::listening')
});

const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

let namespaces = [];
let types = ['deployment','statefulset'];

const {xHubSignatureMiddleware, extractRawBody} = require('x-hub-signature-middleware');
app.use(bodyParser.json({
  verify: extractRawBody
}));

app.use((req,res,next) => {
  if(req.headers['x-hub-signature-256']) {
    return xHubSignatureMiddleware({
      algorithm: 'sha1',
      secret: process.env.AUTHORIZATION,
      require: true
    })(req,res,next);
  }
  if(!req.headers.authorization) { 
    return res.status(401).json({result:"error",message:"missing authorization header"});      
  }            
  let authorization_bearer = "Bearer " + process.env.AUTHORIZATION;        
  if(req.headers.authorization!==authorization_bearer) {                   
    return res.status(401).json({result:"error",message:"invalid authorization bearer token"});
  }            
  next();      
});

app.get('/uptime', (req,res) => {
  res.json({
    start:_START,
    uptime:new Date().getTime() - _START.getTime(),
    commit: process.env.COMMIT
  });
});

app.get('/:namespace/:type/:name', (req,res) => {
  console.log(req.params);
  res.json(req.params);
})
app.post('/:namespace/:type/:name/restart', (req,res) => {
  if(!namespaces.includes(req.params.namespace)) {
    return res.status(503).json({result:"error"});
  }
  //TODO: sanitize inputs
  if(req.params.type=='deployment') {
    k8sAppsApi.patchNamespacedDeployment(req.params.name,req.params.namespace,{
      spec: { template: { metadata: {
        annotations: {
          'rollout-mgr.vanderlist.ca/restart': new Date().toISOString()
        }
      }}}
    },undefined,undefined,"rollout-mgr.vanderlist.ca/restart",undefined,{
      headers: {
        'content-type': 'application/merge-patch+json'
      }
    }).then(result => {
      return res.json({result:"ok"});
      res.json(result.body);
    }).catch(error => {
      console.error(error);
      res.status(503).json({result:'error',error:error.body});
    });
  } else if(req.params.type=='statefulset') {
  } else {
    res.status(503).json({result:'invalid type'});
  }
});

app.get('/:namespace', (req,res) => {
  console.log(`requesting name space ${req.params.namespace}`);
  if(namespaces.includes(req.params.namespace)) {
    let data = {};
    k8sAppsApi.listNamespacedDeployment(req.params.namespace).then(result => {
      data.Deployments = result.body.items.map(deployment=>({name:deployment.metadata.name, status: deployment.spec.status, type: "deployment"}));
      return k8sAppsApi.listNamespacedStatefulSet(req.params.namespace);
    }).then(result => {
      data.StatefulSets = result.body.items.map(deployment=>({name:deployment.metadata.name, status: deployment.spec.status, type: "statefulset"}));
    }).then(() => {
      res.json({result: "ok", ...data});
    })
    .catch(error => {
      console.error('error in fetching name space deployments');
      console.error(error);
      res.status(503).json({msg:error.response});
    })
  } else {
    res.status(404).json({msg:'namespace not found'})
  }
})
app.get('/', (req,res) => {
  res.json(namespaces);
})

k8sApi.listNamespace().then((res) => {
    namespaces = res.body.items.map(ns=>ns.metadata.name);
    console.log('Supported Namespaces: '+namespaces.join(', '));
}).catch(error => {
  console.error(error.response.body);
});
