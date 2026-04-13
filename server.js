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
app.post("/check", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Nicio imagine primită." });
  }

  try {
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


    console.log("--- Încep analiza imaginii cu AI ---");
    for( let z of zoomLevels) {
      const tensor = zoomTensor(img, z);
      
      const predictions = await model.classify(tensor, 10);

      
      console.log("\n--- TOP 10 DETECTATE ---");
      console.table(predictions.map(p => ({
        Clasa: p.className,
        Probabilitate: (p.probability * 100).toFixed(2) + "%"
      })));


      const found = predictions.some(p => catKeywords.some(kw => p.className.toLowerCase().includes(kw)));

      if (found) {
        isCat = true;
        break;
      }
    }

    console.log("ESTE PISICĂ?", isCat ? "DA" : "NU");

    res.json({
      success: true,
      isCat: isCat,
    });

  } catch (error) {
    console.error("Eroare AI:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ success: false, error: "Eroare AI" });
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
    const { userId, latitude, longitude } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Fișierul lipsește" });
    }

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

    fs.unlinkSync(req.file.path);

    const imageUrl = compressedPath;
    const thumbnailUrl = thumbnailPath;

    const newPost = await prisma.post.create({
      data: {
        imageUrl,
        thumbnailUrl,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        user: {
          connect: { id: parseInt(userId) },
        }
      },
    });

    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        catPoints: {
          increment: 1,
        }
      }
    });

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