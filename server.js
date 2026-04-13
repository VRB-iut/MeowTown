import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import cors from "cors";
import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";
import { decode } from "jpeg-js";
import * as tf from "@tensorflow/tfjs";
import mobilenet from "@tensorflow-models/mobilenet";
import sharp from "sharp";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL, 
});
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });
let model;
async function loadModel() {
  console.log("--- Se încarcă modelul AI (MobileNet) ---");
  try {
    model = await mobilenet.load();
    console.log("--- Model AI gata de lucru! ---");
  } catch (err) {
    console.error("Eroare la încărcarea modelului:", err);
  }
}
loadModel();

const imageToTensor = (rawImageData) => {
  const { width, height, data } = decode(rawImageData, { useTArray: true });
  return { width, height, data };
};

const zoomTensor = (img, zoomFactor) => {
  const cropW = Math.floor(img.width * zoomFactor);
  const cropH = Math.floor(img.height * zoomFactor);

  const startX = Math.floor((img.width - cropW) / 2);
  const startY = Math.floor((img.height - cropH) / 2);

  const buffer = new Uint8Array(cropW * cropH * 3);
  let offset = 0;

  for (let y = startY; y < startY + cropH; y++) {
    for (let x = startX; x < startX + cropW; x++) {
      const idx = (y * img.width + x) * 4;

      buffer[offset++] = img.data[idx];    
      buffer[offset++] = img.data[idx + 1];
      buffer[offset++] = img.data[idx + 2];
    }
  }

  return tf.tensor3d(buffer, [cropH, cropW, 3]).resizeBilinear([224, 224]).toFloat();
};

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

function boundedSimilarity(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

async function extractEmbeddingFromImageBuffer(imageBuffer) {
  if (!model) return null;

  const img = imageToTensor(imageBuffer);
  const tensor = zoomTensor(img, 0.9);

  try {
    const activation = model.infer(tensor, true);
    const activationTensor = Array.isArray(activation) ? activation[0] : activation;
    const flattened = activationTensor.flatten();
    const embedding = Array.from(await flattened.data());

    if (Array.isArray(activation)) {
      activation.forEach((t) => t?.dispose?.());
    } else {
      activation?.dispose?.();
    }
    flattened.dispose();

    return embedding;
  } catch (err) {
    console.error("Eroare extragere embedding:", err);
    return null;
  } finally {
    tensor.dispose();
  }
}

async function extractVisualSignatureFromImageBuffer(imageBuffer) {
  const { data } = await sharp(imageBuffer)
    .resize(32, 32, { fit: "cover" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return Array.from(data, (value) => value / 255);
}

async function extractDHashFromImageBuffer(imageBuffer) {
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bits = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      bits.push(left > right ? 1 : 0);
    }
  }

  return bits;
}

function hammingDistance(bitsA, bitsB) {
  if (!Array.isArray(bitsA) || !Array.isArray(bitsB) || bitsA.length !== bitsB.length) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;
  for (let i = 0; i < bitsA.length; i++) {
    if (bitsA[i] !== bitsB[i]) distance++;
  }
  return distance;
}

async function getPostImageBuffer(post) {
  if (!post.imageUrl) return null;

  let localPath = post.imageUrl;
  if (localPath.startsWith("http://") || localPath.startsWith("https://")) {
    const normalized = localPath.replace(/\\/g, "/");
    const marker = "/uploads/";
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex !== -1) {
      localPath = normalized.slice(markerIndex + 1);
    }
  }

  if (!fs.existsSync(localPath)) {
    console.log(`[CHECK] Fișier inexistent pentru post ${post.id}: ${localPath}`);
    return null;
  }

  return fs.readFileSync(localPath);
}

async function getOrCreatePostEmbedding(post) {
  if (post.embedding) {
    try {
      const parsed = JSON.parse(post.embedding);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      console.log(`[CHECK] Embedding invalid pentru post ${post.id}, se va regenera.`);
    }
  }

  const existingBuffer = await getPostImageBuffer(post);
  if (!existingBuffer) {
    return null;
  }
  const generatedEmbedding = await extractEmbeddingFromImageBuffer(existingBuffer);

  if (!generatedEmbedding) {
    return null;
  }

  try {
    await prisma.post.update({
      where: { id: post.id },
      data: { embedding: JSON.stringify(generatedEmbedding) },
    });
  } catch (err) {
    console.log(`[CHECK] Nu am putut salva embedding pentru post ${post.id}:`, err.message);
  }

  return generatedEmbedding;
}

async function detectSameCatInRadius({ lat, lon, newEmbedding, newSignature, newDHash }) {
  let isSameCat = false;
  let bestSimilarity = 0;
  let bestVisualSimilarity = 0;
  let bestHashDistance = Number.POSITIVE_INFINITY;
  let matchedPostId = null;

  if (!(newEmbedding || newSignature || newDHash) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { isSameCat, bestSimilarity, bestVisualSimilarity, bestHashDistance, matchedPostId };
  }

  const searchRadiusMeters = 50;
  const prefilterRadiusMeters = 80;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const latDelta = prefilterRadiusMeters / 111320;
  const lonDivisor = Math.max(0.2, Math.cos(toRadians(lat)));
  const lonDelta = prefilterRadiusMeters / (111320 * lonDivisor);

  const nearbyPosts = await prisma.post.findMany({
    where: {
      createdAt: { gte: sevenDaysAgo },
      latitude: { gte: lat - latDelta, lte: lat + latDelta },
      longitude: { gte: lon - lonDelta, lte: lon + lonDelta },
    },
    select: {
      id: true,
      embedding: true,
      imageUrl: true,
      latitude: true,
      longitude: true,
    },
  });

  const postsIn50m = nearbyPosts.filter((post) => {
    const meters = distanceMeters(lat, lon, post.latitude, post.longitude);
    return meters <= searchRadiusMeters;
  });

  const EMBEDDING_THRESHOLD = 0.75;
  const VISUAL_THRESHOLD = 0.75;
  const COMBINED_THRESHOLD = 0.75;
  const DHASH_THRESHOLD = 12;

  console.log(`[CHECK] Candidati in 50m: ${postsIn50m.length}`);

  for (const post of postsIn50m) {
    try {
      const postImageBuffer = await getPostImageBuffer(post);
      const existingEmbedding = await getOrCreatePostEmbedding(post);
      if (!existingEmbedding || !postImageBuffer) {
        continue;
      }

      const existingSignature = await extractVisualSignatureFromImageBuffer(postImageBuffer);
      const existingDHash = await extractDHashFromImageBuffer(postImageBuffer);

      console.log(
        `[DEBUG] Dim embeddinguri: nou=${newEmbedding?.length || 0}, post=${post.id}, existent=${existingEmbedding.length}`
      );

      const embeddingSimilarity = boundedSimilarity(cosineSimilarity(newEmbedding, existingEmbedding));
      const visualSimilarity = boundedSimilarity(cosineSimilarity(newSignature, existingSignature));
      const combinedSimilarity = (embeddingSimilarity * 0.7) + (visualSimilarity * 0.3);
      const hashDistance = hammingDistance(newDHash, existingDHash);

      bestSimilarity = Math.max(bestSimilarity, embeddingSimilarity);
      bestVisualSimilarity = Math.max(bestVisualSimilarity, visualSimilarity);
      bestHashDistance = Math.min(bestHashDistance, hashDistance);

      console.log(
        `[CHECK] post=${post.id} emb=${(embeddingSimilarity * 100).toFixed(2)}% vis=${(visualSimilarity * 100).toFixed(2)}% comb=${(combinedSimilarity * 100).toFixed(2)}% hashDist=${hashDistance}`
      );

      const strongSignals = [
        embeddingSimilarity >= EMBEDDING_THRESHOLD,
        visualSimilarity >= VISUAL_THRESHOLD,
        combinedSimilarity >= COMBINED_THRESHOLD,
        hashDistance <= DHASH_THRESHOLD,
      ].filter(Boolean).length;

      const isMatch =
        (embeddingSimilarity >= EMBEDDING_THRESHOLD && visualSimilarity >= VISUAL_THRESHOLD) ||
        (embeddingSimilarity >= EMBEDDING_THRESHOLD && hashDistance <= DHASH_THRESHOLD) ||
        (visualSimilarity >= VISUAL_THRESHOLD && hashDistance <= DHASH_THRESHOLD) ||
        strongSignals >= 3;

      if (isMatch) {
        isSameCat = true;
        matchedPostId = post.id;
        console.log(
          `[CHECK] Match pe post ${post.id}: emb=${(embeddingSimilarity * 100).toFixed(2)}% vis=${(visualSimilarity * 100).toFixed(2)}% hashDist=${hashDistance}`
        );
        break;
      }
    } catch {
      continue;
    }
  }

  return { isSameCat, bestSimilarity, bestVisualSimilarity, bestHashDistance, matchedPostId };
}

app.post("/check", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Nicio imagine primită." });
  }

  try {
    const { latitude, longitude } = req.body;
    const lat = Number.parseFloat(latitude);
    const lon = Number.parseFloat(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.log(`[CHECK] Coordonate invalide primite: lat=${latitude}, lon=${longitude}`);
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    const img = imageToTensor(imageBuffer);

    const zoomLevels = [0.9, 0.8, 0.7];
    
    const catKeywords = [
      "cat ",
      "tabby ",
      "siamese ",
      "persian ",
      "egyptian cat",
      "tiger cat",
      "kitten ",
      "felidae "
    ];


    let isCat = false;
    let bestPredictions = [];


    console.log("--- Încep analiza imaginii cu AI ---");
    for( let z of zoomLevels) {
      const tensor = zoomTensor(img, z);
      
      const predictions = await model.classify(tensor, 10);
      tensor.dispose();

      bestPredictions = predictions;

      const top3 = predictions.slice(0, 3).map((p) => ({
        clasa: p.className,
        probabilitate: `${(p.probability * 100).toFixed(2)}%`,
      }));
      console.log(`[CHECK][zoom=${z}] Top 3 predictii:`, top3);


      const found = predictions.some(p => catKeywords.some(kw => p.className.toLowerCase().includes(kw)));

      if (found) {
        isCat = true;
        break;
      }
    }

    console.log("ESTE PISICĂ?", isCat ? "DA" : "NU");

    if (!isCat) {
      return res.json({ success: true, isCat: false, message: "Nu pare să fie o pisică." });
    }

    const newEmbedding = await extractEmbeddingFromImageBuffer(imageBuffer);
    const newSignature = await extractVisualSignatureFromImageBuffer(imageBuffer);
    const newDHash = await extractDHashFromImageBuffer(imageBuffer);

    const {
      isSameCat,
      bestSimilarity,
      bestVisualSimilarity,
      bestHashDistance,
      matchedPostId,
    } = await detectSameCatInRadius({ lat, lon, newEmbedding, newSignature, newDHash });

    if (isSameCat && matchedPostId) {
      await prisma.$executeRawUnsafe('UPDATE "Post" SET "sameCat" = 1 WHERE id = ?', matchedPostId);
    }

    res.json({
      success: true,
      isCat: true,
      isSameCat,
      similarityScore: Number(bestSimilarity.toFixed(4)),
      visualSimilarityScore: Number(bestVisualSimilarity.toFixed(4)),
      hashDistance: Number.isFinite(bestHashDistance) ? bestHashDistance : null,
      matchedPostId,
      topPrediction: bestPredictions[0]?.className || null,
      embedding: newEmbedding ? JSON.stringify(newEmbedding) : null,
    });

  } catch (error) {
    console.error("Eroare AI:", error);
    res.status(500).json({ success: false, error: "Eroare AI" });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.post("/register", async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;

    if (!username || !password || !confirmPassword) {
      return res.json({ success: false, message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.json({ success: false, message: "Passwords do not match" });
    }else if (password.length < 3) {
      return res.json({ success: false, message: "Password must be at least 3 characters long" });
    }else if (username.length < 3) {
      return res.json({ success: false, message: "Username must be at least 3 characters long" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ success: false, message: "All fields are required" });
    }else if(password.length < 3) {
      return res.json({ success: false, message: "Password must be at least 3 characters long" });
    }else if(username.length < 3) {
      return res.json({ success: false, message: "Username must be at least 3 characters long" });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.json({ success: false, message: "Invalid password" });
    }

    return res.json({
      success: true,
      userId: user.id,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.use("/uploads", express.static("uploads"));


app.post("/post", upload.single("file"), async (req, res) => {
  try {
    const { userId, latitude, longitude, embedding } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Fișierul lipsește" });
    }

    const lat = Number.parseFloat(latitude);
    const lon = Number.parseFloat(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ success: false, message: "Coordonate invalide." });
    }

    const originalBuffer = fs.readFileSync(req.file.path);

    const compressedFilename = `compressed_${req.file.filename}.jpg`;
    const thumbnailFilename = `thumb_${req.file.filename}.jpg`;

    const compressedPath = `uploads/${compressedFilename}`;
    const thumbnailPath = `uploads/${thumbnailFilename}`;

    await sharp(req.file.path)
      .resize(800)
      .jpeg({ quality: 70 })
      .toFile(compressedPath);

    await sharp(req.file.path)
      .resize(300)
      .jpeg({ quality: 60 })
      .toFile(thumbnailPath);

    let embeddingToSave = null;
    if (typeof embedding === "string" && embedding.trim().length > 0) {
      embeddingToSave = embedding;
    } else {
      const extractedEmbedding = await extractEmbeddingFromImageBuffer(originalBuffer);
      embeddingToSave = extractedEmbedding ? JSON.stringify(extractedEmbedding) : null;
    }

    let parsedEmbedding = null;
    if (embeddingToSave) {
      try {
        parsedEmbedding = JSON.parse(embeddingToSave);
      } catch {
        parsedEmbedding = null;
      }
    }

    const newSignature = await extractVisualSignatureFromImageBuffer(originalBuffer);
    const newDHash = await extractDHashFromImageBuffer(originalBuffer);
    const duplicateCheck = await detectSameCatInRadius({
      lat,
      lon,
      newEmbedding: parsedEmbedding,
      newSignature,
      newDHash,
    });

    if (duplicateCheck.isSameCat && duplicateCheck.matchedPostId) {
      await prisma.$executeRawUnsafe('UPDATE "Post" SET "sameCat" = 1 WHERE id = ?', duplicateCheck.matchedPostId);
    }

    let byWho = null;
    if (duplicateCheck.isSameCat && duplicateCheck.matchedPostId) {
      const matchedPost = await prisma.post.findUnique({
        where: { id: duplicateCheck.matchedPostId },
        select: {
          byWho: true,
          user: {
            select: { username: true },
          },
        },
      });

      byWho = matchedPost?.byWho || matchedPost?.user?.username || null;
    }

    fs.unlinkSync(req.file.path);

    const imageUrl = compressedPath;
    const thumbnailUrl = thumbnailPath;

    const newPost = await prisma.post.create({
      data: {
        imageUrl,
        thumbnailUrl,
        embedding: embeddingToSave,
        latitude: lat,
        longitude: lon,
        sameCat: duplicateCheck.isSameCat,
        byWho,
        user: {
          connect: { id: parseInt(userId) },
        },
      },
    });

    if (!duplicateCheck.isSameCat) {
      await prisma.user.update({
        where: { id: parseInt(userId) },
        data: {
          catPoints: {
            increment: 1,
          }
        }
      });
    }

    res.json({ success: true, post: newPost });

  } catch (err) {
    console.error("Eroare Prisma:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/posts-for-dashboard', async (req, res) => {
  try {
    const { userId } = req.body;
    const parsedUserId = Number.parseInt(userId, 10);
    const hasValidUserId = Number.isInteger(parsedUserId);
    
    const posts = await prisma.post.findMany({
      include: { 
        user: {
          select: {
            id: true,
            username: true,
            profilePictureUrl: true,
          },
        },
        likedBy: hasValidUserId
          ? {
              where: { userId: parsedUserId },
              select: { id: true },
            }
          : false,
        _count: {
          select: {
            likedBy: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const postsWithLike = posts.map(({ _count, likedBy, ...post }) => ({
      ...post,
      likes: _count.likedBy,
      likedByUser: hasValidUserId ? likedBy.length > 0 : false,
    }));

    res.json({ success: true, posts: postsWithLike });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post('/posts-for-dashboard', async (req, res) => {
  try {
    const { userId } = req.body;
    const parsedUserId = Number.parseInt(userId, 10);
    const hasValidUserId = Number.isInteger(parsedUserId);
    
    const posts = await prisma.post.findMany({
      include: { 
        user: {
          select: {
            id: true,
            username: true,
            profilePictureUrl: true,
          },
        },
        likedBy: hasValidUserId
          ? {
              where: { userId: parsedUserId },
              select: { id: true },
            }
          : false,
        _count: {
          select: {
            likedBy: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const postsWithLike = posts.map(({ _count, likedBy, ...post }) => ({
      ...post,
      likes: _count.likedBy,
      likedByUser: hasValidUserId ? likedBy.length > 0 : false,
    }));

    res.json({ success: true, posts: postsWithLike });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post('/like', async (req, res) => {
  try {
    const { postId, userId } = req.body;
    if (!postId || !userId) return res.status(400).json({ success: false });

    const uId = Number.parseInt(userId, 10);
    const pId = Number.parseInt(postId, 10);

    if (!Number.isInteger(uId) || !Number.isInteger(pId)) {
      return res.status(400).json({ success: false, message: "ID invalid" });
    }

    const post = await prisma.post.findUnique({
      where: { id: pId },
      select: { userId: true }
    });

    if (!post) {
      return res.status(404).json({ success: false, message: "Postarea nu există" });
    }

    const postAuthorId = post.userId;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: {
          userId_postId: { userId: uId, postId: pId }
        }
      });

      let liked = false;

      if (existing) {
        await tx.postLike.delete({ where: { id: existing.id } });
        liked = false;

        await tx.user.update({
          where: { id: postAuthorId },
          data: { catPoints: { decrement: 1 } }
        });
      } else {
        await tx.postLike.create({
          data: { userId: uId, postId: pId }
        });
        liked = true;

        await tx.user.update({
          where: { id: postAuthorId },
          data: { catPoints: { increment: 1 } }
        });
      }

      const likesCount = await tx.postLike.count({ where: { postId: pId } });
      await tx.post.update({
        where: { id: pId },
        data: { likes: likesCount }
      });

      return { liked, likes: likesCount };
    });

    return res.json({ success: true, liked: result.liked, likes: result.likes });
  } catch (err) {
    console.log("Eroare server like:", err);
    res.status(500).json({ success: false });
  }
});

app.delete('/doomsday', async (req, res) => {
  try {
    await prisma.postLike.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    res.json({ success: true, message: "Toate datele au fost șterse." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: "ID lipsă" });

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { 
        posts: {
          orderBy: { createdAt: 'desc' }
        } 
      }
    });

    if (!user) {
      return res.json({ success: false });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


app.put('/users/dark-mode', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "ID lipsă" });

    const uId = parseInt(userId);

    const user = await prisma.user.findUnique({
      where: { id: uId },
      select: { darkMode: true }
    });

    if (!user) return res.status(404).json({ success: false, message: "User negăsit" });

    const updatedUser = await prisma.user.update({
      where: { id: uId },
      data: { darkMode: !user.darkMode }
    });

    res.json({ success: true, darkMode: updatedUser.darkMode });
    console.log(`Dark mode pentru user ${uId} setat la: ${updatedUser.darkMode}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/users/back-button', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "ID lipsă" });

    const uId = parseInt(userId);

    const user = await prisma.user.findUnique({
      where: { id: uId },
      select: { backButtonPossition : true }
    });

    if (!user) return res.status(404).json({ success: false, message: "User negăsit" });

    const updatedUser = await prisma.user.update({
      where: { id: uId },
      data: { backButtonPossition: !user.backButtonPossition }
    });

    res.json({ success: true, backButtonPossition: updatedUser.backButtonPossition });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/leaderboard', async (req, res) => {
  try {
    const topUsers = await prisma.user.findMany({
      orderBy: { catPoints: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        profilePictureUrl: true,
        catPoints: true,
      },
    });
    res.json({ success: true, users: topUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server pe portul ${PORT}`));