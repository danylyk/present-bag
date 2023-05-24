const admin = require('firebase-admin');
const {config} = require('./config');

admin.initializeApp();

const db = admin.firestore();

db.settings({
  ignoreUndefinedProperties: true,
});

const recommendations = db.collection('recommendations');
const timeline = db.collection('timeline');
const wishes = db.collection('wishes');
const users = db.collection('users');

const store = {
  add: async (chat, content, features) => {
    return wishes.add({
      chat,
      content,
      features,
    });
  },
  addUser: async (chat, username, firstName, lastName, languageCode, isBot, id) => {
    const user = await store.getUser(chat);

    if (user) {
      return user;
    }

    return users.add({
      chat,
      username,
      firstName,
      lastName,
      languageCode,
      isBot,
      id,
    });
  },
  getRecommendations: async (features) => {
    if (!features || features.length === 0) {
      return [];
    }

    const snapshot = await recommendations.where('features', 'array-contains-any', features).get();
    const items = [];

    snapshot.forEach((item) => {
      items.push({
        id: item.id,

        ...item.data(),
      });
    });

    return items;
  },
  getRecommendation: async (id) => {
    const snapshot = await recommendations.doc(id).get();

    if (snapshot.exists) {
      return snapshot.data();
    }

    return undefined;
  },
  getWishlist: async (chat) => {
    const snapshot = await wishes.where('chat', '==', +chat).get();
    const items = [];

    snapshot.forEach((item) => {
      items.push({
        id: item.id,

        ...item.data(),
      });
    });

    return items;
  },
  getTimeline: async (chat) => {
    const snapshot = await timeline.where('chat', '==', +chat).get();
    const items = [];

    snapshot.forEach((item) => {
      const recommendation = item.data()?.recommendation;

      if (recommendation) {
        items.push(recommendation);
      }
    });

    return items;
  },
  getUser: async (chat) => {
    const snapshot = await users.where('chat', '==', +chat).limit(1).get();

    if (snapshot.empty) {
      return undefined;
    }

    return snapshot.docs[0].data();
  },
  getWishlistPage: async (chat, page) => {
    const list = await store.getWishlist(chat);

    if (page > 0 && list.length >= config.count && list.length <= page * config.count) {
      page = Math.ceil(list.length / config.count) - 1;
    }

    const items = list.slice(page * config.count, (page + 1) * config.count);

    return {
      items,
      page,
      end: list.length <= (page + 1) * config.count,
    };
  },
  addEvent: async (chat, recommendation) => {
    return timeline.add({
      chat,
      recommendation,
      time: Date.now(),
    });
  },
  deleteWish: async (chat, page, index) => {
    const list = await store.getWishlist(chat);

    const wish = list[index];

    if (wish) {
      wishes.doc(wish.id).delete();
      list.splice(index, 1);
    }

    if (page > 0 && list.length >= config.count && list.length <= page * config.count) {
      page = Math.ceil(list.length / config.count) - 1;
    }

    const items = list.slice(page * config.count, (page + 1) * config.count);

    return {
      items,
      page,
      end: list.length <= (page + 1) * config.count,
    };
  },
  clearTimeline: async () => {
    const now = Date.now();

    const snapshot = await timeline.where('time', '<=', now).get();

    const batch = db.batch();

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    return batch.commit();
  },
  createRecommendation: async (link, content, features) => {
    const snapshot = await recommendations.where('link', '==', link).limit(1).get();

    if (snapshot.empty) {
      recommendations.add({
        link,
        content,
        features,
      });
    }
  },
};

exports.store = store;
