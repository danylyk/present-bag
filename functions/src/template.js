const {config} = require('./config');

const template = {
  renderWish: (item) => {
    return `${item.content}`;
  },
  renderOrderedWish: (index, page, item) => {
    return `${(page * config.count) + index + 1}. ${template.renderWish(item)}`;
  },
  renderWishlist: (items, page) => {
    const lines = [];

    items.forEach((item, index) => {
      lines.push(template.renderOrderedWish(index, page, item));
    });

    return lines.join('\n');
  },
};

exports.template = template;
