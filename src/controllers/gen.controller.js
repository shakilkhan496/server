import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ServerError } from "../utils/errors.js";

export const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const getPresignedURL = async (req, res) => {
  try {
    const { fileType, fileName } = req.body;
    const splittedFileType = fileType.split("/");
    const type = splittedFileType[1];
    const key = fileName || `${uuidv4()}.${type}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    res.send({ url });
  } catch (err) {
    ServerError(res, "Unable to get signed url");
  }
};

export default { getPresignedURL };
