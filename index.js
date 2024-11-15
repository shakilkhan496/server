import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import "./src/config/database.js";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";


dotenv.config();



const app = express();
// Configure multer to store file data in memory
const upload = multer({ storage: multer.memoryStorage() });

// Route Files
import authRoutes from "./src/routes/auth/index.js";
import genRoutes from "./src/routes/gen/index.js";
import listingRoutes from "./src/routes/listing/index.js";
import { client } from "./src/controllers/gen.controller.js";
import User from "./src/models/User.js";
import Stripe from "stripe";
import Listing from "./src/models/Listing.js";
import ListingSubscription from "./src/models/ListingSubscription.js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


const uploadAttachment = async (req, res) => {
  try {
    const file = req.file;
    console.log({ file });

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileExtension = file.originalname.split(".").pop();
    const s3Key = `attachments/${uuidv4()}.${fileExtension}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await client.send(command);

    const url = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    res.json({ url });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
};

// Express Route to Download a File from S3
const downloadFile = async (req, res) => {
  try {
    const fileKey = req.params.key; // Extract file key from URL parameter

    // Create S3 GetObject command
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey, // The file key or path in S3
    });

    // Fetch the file from S3
    const { Body } = await client.send(command);

    // Pipe the S3 object directly to the response stream
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(fileKey)}"`);

    // Use the stream to pipe the data from S3 directly to the client
    pipeline(Body, res, (err) => {
      if (err) {
        console.error("Error downloading file", err);
        res.status(500).send("Failed to download file.");
      }
    });

  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
};




// Middlewares
// Middleware to parse JSON for all routes except Stripe webhook

app.use((req, res, next) => {
  if (req.originalUrl === "/listing/customer/subscribe-webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(cookieParser());
app.use(
  cors({
    origin: [process.env.FRONTEND_APP_URL],
    optionsSuccessStatus: 200,
    credentials: true,
  })
);

app.use("/auth", authRoutes);
app.use("/gen", genRoutes);
app.use("/listing", listingRoutes);
app.post("/upload-attachment", upload.single("file"), uploadAttachment);
app.get("/download/:key", downloadFile);
app.get('/api/customer-packs', async (req, res) => {
  const { email } = req.query; // Get user email from query params
  try {
    const customer = await User.findOne({ email, type: "customer" });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.status(200).json(customer.customer_viewable_packs);
  } catch (error) {
    console.error("Error fetching customer packs:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// Get Seller's Data by Email (to view requested packs)
app.get('/api/seller', async (req, res) => {
  try {
    const { email } = req.query; // Get email from query
    const seller = await User.findOne({ email, type: 'seller' });

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    res.status(200).json({ user: seller });
  } catch (error) {
    console.error('Error fetching seller:', error);
    res.status(500).json({ message: 'Error fetching seller' });
  }
});

// API to accept a requested pack
app.put('/api/admin/packs/accept', async (req, res) => {
  const { email, item_name } = req.body;
  try {
    const seller = await User.findOne({ email, type: 'seller' });

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    // Find the requested pack by item_name
    const pack = seller.requested_pack.find(p => p.item_name === item_name);

    if (!pack) {
      return res.status(404).json({ message: 'Requested pack not found' });
    }

    // Update pack permission to accepted
    pack.permission = 'accepted';
    await seller.save();

    // Update customer data (using the email found in the seller's requested_pack)
    const customer = await User.findOne({ email: pack.email, type: 'customer' });

    if (customer) {
      // Find the corresponding requested pack in the customer data
      const customerPack = customer.customer_viewable_packs.find(p => p.item_name === item_name);

      if (customerPack) {
        customerPack.permission = 'accepted';
        await customer.save();
      }
    }

    res.status(200).json(pack);
  } catch (error) {
    console.error('Error accepting pack:', error);
    res.status(500).json({ message: 'Error accepting pack' });
  }
});

// API to reject a requested pack
app.put('/api/admin/packs/reject', async (req, res) => {
  const { email, item_name } = req.body;
  try {
    const seller = await User.findOne({ email, type: 'seller' });

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    // Find the requested pack by item_name
    const pack = seller.requested_pack.find(p => p.item_name === item_name);

    if (!pack) {
      return res.status(404).json({ message: 'Requested pack not found' });
    }

    // Update pack permission to rejected
    pack.permission = 'rejected';
    await seller.save();

    // Update customer data (using the email found in the seller's requested_pack)
    const customer = await User.findOne({ email: pack.email, type: 'customer' });

    if (customer) {
      // Find the corresponding requested pack in the customer data
      const customerPack = customer.customer_viewable_packs.find(p => p.item_name === item_name);

      if (customerPack) {
        customerPack.permission = 'rejected';
        await customer.save();
      }
    }

    res.status(200).json(pack);
  } catch (error) {
    console.error('Error rejecting pack:', error);
    res.status(500).json({ message: 'Error rejecting pack' });
  }
});
app.get('/', async (req, res) => {
  res.send({
    message:`server is running at ${PORT}`
  })
})
// API to delete a requested pack
app.delete('/api/admin/packs', async (req, res) => {
  const { email, item_name } = req.body;
  try {
    // Also delete the pack from the customer's viewable packs (if they exist)
    const seller = await User.findOne({ email, type: 'seller' });
    const packIndex = seller.requested_pack.findIndex(p => p.item_name === item_name);


    const customer = await User.findOne({ email: seller.requested_pack[packIndex].email, type: 'customer' });

    if (customer) {
      const customerPackIndex = customer.customer_viewable_packs.findIndex(p => p.item_name === item_name);

      if (customerPackIndex !== -1) {
        customer.customer_viewable_packs.splice(customerPackIndex, 1);
        await customer.save();
      }
    }


    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    

    if (packIndex === -1) {
      return res.status(404).json({ message: 'Requested pack not found' });
    }

    // Remove the pack from the requested_pack array
    seller.requested_pack.splice(packIndex, 1);
    await seller.save();

    

    res.status(200).json({ message: 'Requested pack deleted successfully' });
  } catch (error) {
    console.error('Error deleting pack:', error);
    res.status(500).json({ message: 'Error deleting pack' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
