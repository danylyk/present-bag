const {getMeta} = require('./meta');
const {store} = require('./store');

const service = {
  getWishlist: async (chat) => {
    const [wishlist, user] = await Promise.all([
      store.getWishlist(chat),
      store.getUser(chat),
    ]);

    return {
      items: wishlist,
      user,
    };
  },
  getWishlistPage: async (chat, page) => {
    const wishlist = await store.getWishlistPage(chat, page);

    return {
      page: wishlist.page,
      items: wishlist.items,
      prev: wishlist.page !== 0,
      next: !wishlist.end,
    };
  },
  addUser: async (chat, username, firstName, lastName, languageCode, isBot, id) => {
    return store.addUser(chat, username, firstName, lastName, languageCode, isBot, id);
  },
  addWish: async ({chat, content}, linking = true) => {
    const links = {};
    const features = new Set();

    if (linking) {
      (content.match(/(https?:\/\/[^\s]+)/g) || []).forEach(async (link) => {
        if (!(link in links)) {
          links[link] = '';
        }
      });

      await Promise.all(Object.keys(links).map(async (link) => {
        const meta = await getMeta(link);

        meta?.features.forEach((feature) => {
          features.add(feature);
        });

        if (meta?.title) {
          links[link] = `${meta.title} [▶️](${link})`;

          return;
        }

        delete links[link];
      }));
    }

    const wish = Object.keys(links).reduce((content, link) => {
      return content.replace(link, links[link]);
    }, content);

    await store.add(chat, wish, Array.from(features));

    return {
      content: wish,
    };
  },
  deleteWish: async (chat, page, index) => {
    const wishlist = await store.deleteWish(chat, page, index);

    return {
      page: wishlist.page,
      items: wishlist.items,
      prev: wishlist.page !== 0,
      next: !wishlist.end,
    };
  },
  addEvent: async (chat, recommendation) => {
    return store.addEvent(chat, recommendation);
  },
  addRecommendation: async (chat, id) => {
    const recommendation = await store.getRecommendation(id);

    if (recommendation) {
      await service.addWish({
        chat,
        content: recommendation.content,
      }, false);
    }
  },
  clearTimeline: async () => {
    return store.clearTimeline();
  },
  createRecommendation: async (link) => {
    const meta = await getMeta(link);

    if (!meta?.title) {
      return undefined;
    }

    const recomendation = {
      link,
      content: `${meta.title} [▶️](${link})`,
      features: meta.features,
    };

    await store.createRecommendation(recomendation.link, recomendation.content, recomendation.features);

    return recomendation;
  },
  getRecommendation: async (chat) => {
    const [wishlist, timeline] = await Promise.all([
      store.getWishlist(chat),
      store.getTimeline(chat),
    ]);

    const links = new Set();
    const features = {};
    const weight = {
      value: 0,
    };

    wishlist.forEach((wish) => {
      (wish.content.match(/(https?:\/\/[^\s]+)/g) || []).forEach((link) => {
        links.add(link);
      });

      if (wish.features && wish.features.length > 0) {
        weight.value += 1;
      }

      (wish.features ?? []).forEach((feature) => {
        if (!(feature in features)) {
          features[feature] = 0;
        }

        features[feature] += 1;
      });
    });

    Object.keys(features).forEach((feature) => {
      features[feature] = features[feature] / weight.value;
    });

    const recommendations = await store.getRecommendations(Object.keys(features));

    const weights = recommendations.filter((recommendation) => {
      return !links.has(recommendation.link);
    }).filter((recommendation) => {
      return !timeline.includes(recommendation.id);
    }).map((recommendation) => ({
      id: recommendation.id,
      content: recommendation.content,
      weight: recommendation.features.reduce((weight, feature) => {
        return weight += features[feature] || 0;
      }, 0),
    }));

    if (weights.length === 0) {
      return undefined;
    }

    const recommendation = weights.reduce((selected, recommendation) => {
      if (recommendation.weight > selected.weight) {
        return recommendation;
      }

      return selected;
    }, weights[0]);

    return {
      id: recommendation.id,
      content: recommendation.content,
    };
  },
};

exports.service = service;
