const functions = require('firebase-functions');

const {bot} = require('./src/bot');
const {service} = require('./src/service');

exports.webhook = functions.https.onRequest((req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

exports.cleaning = functions.pubsub.schedule('0 0 */3 * *').onRun(async () => {
  service.clearTimeline();
});

exports.recommend = functions.https.onRequest(async (req, res) => {
  const link = req.query.product;

  if (!link) {
    res.sendStatus(400);

    return;
  }

  const recomendation = await service.createRecommendation(link);

  res.set('Content-Type', 'application/json');
  res.status(200).json(recomendation);
});
