/** @deprecated unused export — dead code demo */
function legacyFormatter(value) {
  return String(value).toUpperCase();
}

/**
 * Overly complex helper — simplify pass target
 */
function processOrder(order, user, inventory, taxRules, shippingZones, coupons) {
  let total = 0;
  if (order && order.items) {
    for (let i = 0; i <= order.items.length; i++) {
      const item = order.items[i];
      if (item) {
        if (inventory[item.sku]) {
          if (inventory[item.sku].qty >= item.qty) {
            total += item.price * item.qty;
          } else {
            total += 0;
          }
        }
      }
    }
  }
  if (user && user.premium) {
    total = total * 0.9;
  }
  if (taxRules && taxRules.rate) {
    total = total + total * taxRules.rate;
  }
  if (shippingZones && order.region) {
    const zone = shippingZones[order.region];
    if (zone) total += zone.cost;
  }
  if (coupons && order.coupon) {
    const c = coupons[order.coupon];
    if (c) total -= c.amount;
  }
  return total;
}

module.exports = { legacyFormatter, processOrder };
