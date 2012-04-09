# About

S3ncrypted Proxy was created to make securely sharing Virtual Box images easy but will work with any type of file!

# Quick Start

Install s3ncrypted_proxy global, this will make the command s3ncryped_proxy available in your path (otherwise just install from git):

```
sudo npm install -g s3ncypted_proxy
```

Generate yourself a strong password/key and put into a file:

```
umask 077 # the passphrase file will have perms 700
openssl rand -base64 12 > .gpg_passphrase
```

Use this to encrypt your box file:

```
gpg -c --passphrase-file .gpg_passphrase <file>
```

Future versions will allow you to upload the file with curl. For now, use the S3 management GUI to upload the gpg encrypted <file>.gpg. 

Get the size of the orginal file:

```
wc -c <file>
```

Go into the properties of the uploaded gpg file in S3. Add the following meta data:

key: x-amz-meta-gpg-content-length
value : &lt;size of unencrypted file from above&gt;

Click save.

Create a config.json file in the S3Encrypted Proxy dir:

```
{
"aws_key": "<your key>",
"aws_secret": "<you secret>",
"gpg_passphrase_file" : ".gpg_passphrase"
}
```

Start S3ncrypted Proxy:

node s3ncrypted_proxy


Now point vagrant, or whatever to http://localhost:8000/bucket/object. If the object ends in .gpg it will automatically decrypted on the fly as it downloads!

# Sharing

Use Amazon IAM to create new user credentials and give them read permissions to your encrypted files. They will need these and the .gpg_passphrase file in order to use S3ncrypted Proxy

#Future Ideas

I want to make uploading easy with curl.  It should be easy but I might not get to it for a while so feel free to send me a pull request.
