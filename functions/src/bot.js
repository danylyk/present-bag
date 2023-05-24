const {Telegraf, Markup} = require('telegraf');
const {message} = require('telegraf/filters');

const {config} = require('./config');
const {service} = require('./service');
const {template} = require('./template');

const bot = new Telegraf(config.key);

bot.telegram.setWebhook(config.webhook);

const factory = {
  getViewKeyboard: (page, prev, next) => {
    const pagination = [];
    const keyboard = [
      [
        {text: 'Delete', callback_data: `delete-${page}`},
      ],
    ];

    if (prev) pagination.push({text: 'Prev', callback_data: `view-${page - 1}`});
    if (next) pagination.push({text: 'Next', callback_data: `view-${page + 1}`});

    if (pagination.length > 0) {
      keyboard.unshift(pagination);
    }

    return Markup.inlineKeyboard(keyboard).resize();
  },
  getRecommendationKeyboard: (id) => {
    return Markup.inlineKeyboard([
      [
        {text: 'Add to list', callback_data: `recommend-${id}`},
      ],
    ]).resize();
  },
  getDeleteKeyboard: (page, length) => {
    const keyboard = [
      [
        {text: 'Cancel', callback_data: `view-${page}`},
      ],
    ];

    const buttons = [];

    for (let i = 0; i < Math.ceil(length / config.buttons); i++) {
      const row = [];

      for (let j = i * config.buttons; j < Math.min(length, (i + 1) * config.buttons); j++) {
        const index = page * config.count + j;

        row.push({text: `${index + 1}`, callback_data: `delete-wish-${index}`});
      }

      buttons.push(row);
    }

    buttons.reverse().forEach((row) => {
      keyboard.unshift(row);
    });

    return Markup.inlineKeyboard(keyboard).resize();
  },
  error: (ctx) => {
    ctx.reply('😔 *Opps*, something went wrong, try later.', {parse_mode: 'Markdown'});
  },
  empty: (ctx, rewrite = false) => {
    if (rewrite) {
      ctx.editMessageText('You haven\'t got any *wishes* yet.', {parse_mode: 'Markdown'});

      return;
    }

    ctx.reply('You haven\'t got any *wishes* yet.', {parse_mode: 'Markdown'});
  },
};

bot.start(async (ctx) => {
  try {
    service.addUser(ctx.chat.id, ctx.from.username, ctx.from.first_name, ctx.from.last_name, ctx.from.language_code, ctx.from.is_bot, ctx.from.id);

    const chat = decodeURIComponent(atob((ctx.startPayload ?? '').trim()));

    if (!chat) {
      ctx.reply(`Welcome to the Present Bag!`);

      return;
    }

    const wishlist = await service.getWishlist(chat);

    if (wishlist.items.length === 0) {
      ctx.reply(`${wishlist.user?.username ? `@${wishlist.user.username}` : 'The user'} hasn't got any wishes yet.`);

      return;
    }

    const render = template.renderWishlist(wishlist.items, 0);

    ctx.reply(`*${wishlist.items.length} wish${wishlist.items.length === 1 ? '' : 'es'}* of ${wishlist.user?.username ? `@${wishlist.user.username}` : 'the user'}\n---\n${render}`, {
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    factory.error(ctx);
  }
});

bot.command('share', async (ctx) => {
  try {
    ctx.reply(`🎁 *Spread the joy of gift-giving!* 🎁\n${config.url}?start=${btoa(encodeURIComponent(ctx.chat.id))}`, {
      parse_mode: 'Markdown',
    });
  } catch (e) {
    factory.error(ctx);
  }
});

bot.command('recommend', async (ctx) => {
  try {
    const recommendation = await service.getRecommendation(ctx.chat.id);

    if (!recommendation) {
      ctx.reply('😔 No recommendation found for now, try to add some wishes or try later.');

      return;
    }

    service.addEvent(ctx.chat.id, recommendation.id);

    const keyboard = factory.getRecommendationKeyboard(recommendation.id);

    ctx.reply(recommendation.content, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  } catch (e) {
    factory.error(ctx);
  }
});

bot.action(/recommend-(\S+)/, async (ctx) => {
  try {
    const recommendation = ctx.match[1].trim();

    if (recommendation) {
      service.addRecommendation(ctx.chat.id, recommendation);
    }

    ctx.editMessageReplyMarkup();
  } catch (e) {
    factory.error(ctx);
  }
});

bot.command('list', async (ctx) => {
  try {
    const wishlist = await service.getWishlistPage(ctx.chat.id, 0);

    if (wishlist.items.length === 0) {
      return factory.empty(ctx);
    }

    const render = template.renderWishlist(wishlist.items, 0);
    const keyboard = factory.getViewKeyboard(0, wishlist.prev, wishlist.next);

    ctx.reply(render, {
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  } catch (e) {
    factory.error(ctx);
  }
});

bot.action(/view-(\d+)/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1]);

    const wishlist = await service.getWishlistPage(ctx.chat.id, page);

    if (wishlist.items.length === 0) {
      return factory.empty(ctx, true);
    }

    const render = template.renderWishlist(wishlist.items, wishlist.page);
    const keyboard = factory.getViewKeyboard(wishlist.page, wishlist.prev, wishlist.next);

    ctx.editMessageText(render, {
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  } catch (e) {
    factory.error(ctx);
  }
});

bot.action(/delete-(\d+)/, async (ctx) => {
  try {
    const page = parseInt(ctx.match[1]);

    const wishlist = await service.getWishlistPage(ctx.chat.id, page);

    if (wishlist.items.length === 0) {
      return factory.empty(ctx, true);
    }

    const render = template.renderWishlist(wishlist.items, wishlist.page);
    const keyboard = factory.getDeleteKeyboard(wishlist.page, wishlist.items.length);

    ctx.editMessageText(render, {
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  } catch (e) {
    factory.error(ctx);
  }
});

bot.action(/delete-wish-(\d+)/, async (ctx) => {
  try {
    const index = parseInt(ctx.match[1]);
    const page = Math.floor(index / config.count);

    const wishlist = await service.deleteWish(ctx.chat.id, page, index);

    if (wishlist.items.length === 0) {
      return factory.empty(ctx, true);
    }

    const render = template.renderWishlist(wishlist.items, wishlist.page);
    const keyboard = factory.getViewKeyboard(wishlist.page, wishlist.prev, wishlist.next);

    ctx.editMessageText(render, {
      disable_web_page_preview: true,
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  } catch (e) {
    factory.error(ctx);
  }
});

bot.on(message('text'), async (ctx) => {
  try {
    const wish = await service.addWish({
      chat: ctx.chat.id,
      content: ctx.message.text,
    });

    ctx.reply(`✅ ${wish.content}`, {disable_web_page_preview: true, parse_mode: 'Markdown'});
  } catch (e) {
    factory.error(ctx);
  }
});

exports.bot = bot;
