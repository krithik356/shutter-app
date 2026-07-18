import axios from "axios";
import "dotenv/config";

const GRAPH_API = "https://graph.instagram.com/v21.0";
const IG_USER_ID = process.env.INSTAGRAM_USER_ID;
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;


console.log("Publishing with IG ID:", IG_USER_ID);


async function createMediaContainer(imageUrl, caption) {
  const response = await axios.post(
    `${GRAPH_API}/${IG_USER_ID}/media`,
    null,
    {
      params: {
        image_url: imageUrl,
        caption: caption,
        access_token: ACCESS_TOKEN,
      },
    }
  );

  return response.data.id;
}

async function publishMedia(containerId) {
  const response = await axios.post(
    `${GRAPH_API}/${IG_USER_ID}/media_publish`,
    null,
    {
      params: {
        creation_id: containerId,
        access_token: ACCESS_TOKEN,
      },
    }
  );

  return response.data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postToInstagram() {
  try {
    const imageUrl =
      "https://i.ibb.co/RG7xQr9n/Screenshot-from-2026-07-16-23-20-19.png";

    const caption = "My first automatic Instagram post 🚀";

    console.log("Creating media container...");

    const containerId = await createMediaContainer(imageUrl, caption);

    console.log("Container created:", containerId);
    console.log("Waiting for Instagram to process the image...");

    await sleep(10000);

    console.log("Publishing post...");

    const result = await publishMedia(containerId);

    console.log("✅ Posted successfully!");
    console.log(result);
  } catch (err) {
    console.error(
      "❌ Instagram API Error:",
      err.response?.data || err.message
    );
  }
}

postToInstagram();