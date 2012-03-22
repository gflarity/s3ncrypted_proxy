#!/usr/bin/env node

var request = require('request');
var fs = require('fs');
var spawn = require('child_process').spawn;
var crypto = require('crypto');
var restify = require('restify');
var http = require('http');

var config = JSON.parse( fs.readFileSync( require.resolve('./config.json') ) );

var awsKey = config.aws_key;
var awsSecret = config.aws_secret;
var gpg_passphrase_file = require.resolve(config.gpg_passphrase_file);

function sign( method ,resource, param_string, expiry, awsSecret ) {
        
    var string = method + '\n\n\n' + expiry + '\n' + resource +
              param_string;
    	         
    var sig = encodeURIComponent(crypto.createHmac('sha1',awsSecret).update(string).digest('base64'));
    return sig;
};

function get_unecrypted_content_length( url, cb) {
    
    debugger;
    var matches = url.match( /https?\:\/\/([\w\-\.]+)(\/.*)/ );
    var host = matches[1];
    var path = matches[2];        
        
    //console.log(url);
    var options = {
      host: host,
      port: 80,
      path: path,
      method: 'HEAD'
    };
    
    
    var req = http.request(options, function(res) {        
        //console.log( JSON.stringify(res.headers) );
        cb( res.headers['x-amz-meta-gpg-content-length'] );
    });
    req.end();        
    
    
}

function generate_url( resource, expiry, sig, filename ) {
    
    var url = 'http://s3.amazonaws.com' + resource +'?Expires='+ expiry + '&AWSAccessKeyId='
        + awsKey + '&Signature='+ sig + '&response-content-disposition=attachment;'+ 'filename=' + filename;
    return url;
}

function gpg_proxy( req, res, next ) {
        
    var filename =  req.params[1];    
    var resource = req.params[0] + filename;
    var param_string =  '?response-content-disposition=attachment;filename='+filename;
    
    var dateObj = new Date;
    var now = dateObj.getTime();
    var expiry = parseInt(now / 1000)+60;
        
    var sig_head = sign( 'HEAD', resource, param_string, expiry, awsSecret );
    var sig_get = sign( 'GET', resource, param_string, expiry, awsSecret );
    
    var url_get = generate_url(  resource, expiry, sig_get, filename);
    var url_head = generate_url( resource, expiry, sig_head, filename );
    //console.log( url_get );

    //after we get the unencrypted content-length, send as the real one
    //along with the file
    var on_got_unecrypted_content_length = function(content_length_estimate) {
        
            var gpg = spawn('gpg', ['--passphrase-file', gpg_passphrase_file, '-d']);
            res.header( 'Content-Length', content_length_estimate );
            gpg.stdout.pipe( res );
        
            request( url_get ).pipe( gpg.stdin );
            gpg.on('exit', function(code) {
                console.log('child process exited with code ' + code);
            });
            gpg.stderr.on('data', function(data) {
                console.log('' + data);
            });
    }    

    var content_length = get_unecrypted_content_length( url_head, on_got_unecrypted_content_length );
}

function proxy( req, res, next  ) {

    var filename =  req.params[1];    
    var resource = req.params[0] + filename;
    var param_string =  '?response-content-disposition=attachment;filename='+filename;
       
    var dateObj = new Date;
    var now = dateObj.getTime();
    var expiry = parseInt(now / 1000)+60;
    var sig = sign( resource, param_string, expiry, awsSecret );
    
    var url = generate_url( resource, expiry, sig, filename);
    request(url).pipe( res );
}


var server = restify.createServer({
  name: 'S3ncryptedProxy',
});

server.get('/favicon.ico',  function ( req, res, next ) {
  return next(new restify.InvalidArgumentError("NO ICONS HERE"));
});
server.get(/(.*\/)([\w\.\-\_]+\.gpg)$/, gpg_proxy );
server.get(/(.*\/)([\w\.\-\_]+)$/, proxy );

server.listen(8000);
