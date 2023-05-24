const axios = require('axios');
const cheerio = require('cheerio');

exports.getMeta = async (url) => {
  try {
    const response = await axios.get(url);

    const $ = cheerio.load(response.data);

    const title = $('head title').text();

    // Rule for ek.ua
    const features = $('.catalog-path a').map((index, element) => $(element).text()).get() || [];

    return {
      title,
      features,
    };
  } catch (e) {
    return undefined;
  }
};
