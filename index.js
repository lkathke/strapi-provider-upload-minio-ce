const Minio = require('minio');
const mime = require("mime-types");
const utils = require("./utils");

module.exports = {
  init(providerOptions) {
    const { port, useSSL, endPoint, accessKey, secretKey, bucket, host, folder, isPrivateBucket, presignedUrlExpiration } = providerOptions;
    const MINIO = new Minio.Client({
      endPoint,
      port: +port || 9000,
      useSSL: useSSL === "true",
      accessKey,
      secretKey,
    });

    const ACL = ACL || "public-read";

    const getUploadPath = (file) => {
      const pathChunk = file.path ? `${file.path}/` : '';
      const path = folder ? `${folder}/${pathChunk}` : pathChunk;

      return `${path}${file.hash}${file.ext}`;
    };
    const getDeletePath = (file) => {
      const hostPart = (useSSL === 'true' ? 'https://' : 'http://') + `${host}:${port}/${bucket}/`;
      const path = file.url.replace(hostPart, '');

      return path;
    };
    return {
      uploadStream(file) {
        return this.upload(file);
      },
      upload(file) {
        return new Promise((resolve, reject) => {
          // upload file to a bucket
          const path = getUploadPath(file);
          
          const metaData = {
            'Content-Type': mime.lookup(file.ext) || 'application/octet-stream',
          }

          MINIO.putObject(
            bucket,
            path,
            file.stream || Buffer.from(file.buffer, 'binary'),
            metaData,
            (err, _etag) => {
              if (err) {
                return reject(err);
              }

              const hostPart = (useSSL === 'true' ? 'https://' : 'http://') + `${host}:${port}/`
              const filePath = `${bucket}/${path}`;
              file.url = `${hostPart}${filePath}`;

              resolve();
            }
          );
        });
      },
      delete(file) {
        return new Promise((resolve, reject) => {
          const path = getDeletePath(file);

          MINIO.removeObject(bucket, path, err => {
            if (err) {
              return reject(err);
            }

            resolve();
          });
        });
      },
      getSignedUrl(file) {
        const { file_url_bucket } = utils.getBucketFromUrl(file.url);
        if (file_url_bucket !== bucket) {
          return { url: file.url };
        }

        return new Promise((resolve, reject) => {
          const uploadPath = utils.getUploadPath(file);

          MINIO.presignedUrl('GET', bucket, uploadPath, presignedUrlExpiration || 24*60*60, function(err, presignedUrl) {
            if (err) {
              return reject(err);
            }
            resolve({ presignedUrl });
          });

         
        });
      },
      isPrivate() {
        return isPrivateBucket;
      }
    };
  },
};
