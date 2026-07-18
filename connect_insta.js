import axios from "axios";

export async function getLongLivedToken(shortLivedToken, instagramAppSecret) {
  const response = await axios.get(
    "https://graph.instagram.com/access_token",
    {
      params: {
        grant_type: "ig_exchange_token",
        client_secret: instagramAppSecret,
        access_token: shortLivedToken,
      },
    }
  );

  return response.data;
}