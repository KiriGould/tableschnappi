import { v4 as uuid } from 'uuid'
import { store } from './store'
import { MenuItem, Order, Table } from './types'

function minutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60 * 1000).toISOString()
}

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60 * 1000).toISOString()
}

export function seed() {
  // ── Restaurants ─────────────────────────────────────────────────────────
  const sakuraId = 'rest-sakura'
  const koiId = 'rest-koi'

  store.restaurants.set(sakuraId, {
    id: sakuraId, name: 'Sakura Japanese', nameJa: '桜', slug: 'sakura',
    cuisine: 'Japanese', address: 'Bahnhofstrasse 42, 8001 Zürich',
    priceRange: '$$', coordinates: { lat: 47.3769, lng: 8.5417 },
    phone: '+41 44 123 45 67',
    settings: { drinkServiceTime: 30, foodServiceTime: 60, averageDineTime: 90, layoutWidth: 7, layoutHeight: 6 }
  })

  store.restaurants.set(koiId, {
    id: koiId, name: 'Koi Ramen', nameJa: '鯉ラーメン', slug: 'koi',
    cuisine: 'Japanese Ramen', address: 'Langstrasse 88, 8004 Zürich',
    priceRange: '$', coordinates: { lat: 47.3783, lng: 8.5298 },
    phone: '+41 44 987 65 43',
    settings: { drinkServiceTime: 20, foodServiceTime: 45, averageDineTime: 60, layoutWidth: 6, layoutHeight: 4 }
  })

  // ── Sakura Tables ────────────────────────────────────────────────────────
  const sakuraTables: Omit<Table, 'id'>[] = [
    { restaurantId: sakuraId, number: 1, seats: 2, position: { x: 0, y: 0, w: 1, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 2, seats: 2, position: { x: 1, y: 0, w: 1, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 3, seats: 4, position: { x: 2, y: 0, w: 2, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 4, seats: 4, position: { x: 4, y: 0, w: 2, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 5, seats: 4, position: { x: 0, y: 2, w: 2, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 6, seats: 6, position: { x: 2, y: 2, w: 2, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 7, seats: 6, position: { x: 4, y: 2, w: 2, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 8, seats: 2, position: { x: 0, y: 4, w: 1, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 9, seats: 2, position: { x: 1, y: 4, w: 1, h: 1 }, status: 'free' },
    { restaurantId: sakuraId, number: 10, seats: 4, position: { x: 2, y: 4, w: 2, h: 1 }, status: 'free' },
  ]

  const tableIds: string[] = []
  sakuraTables.forEach((t) => {
    const id = `tbl-sakura-${t.number}`
    tableIds.push(id)
    store.tables.set(id, { ...t, id })
  })

  // ── Koi Tables ───────────────────────────────────────────────────────────
  const koiTableDefs: Omit<Table, 'id'>[] = [
    { restaurantId: koiId, number: 1, seats: 2, position: { x: 0, y: 0, w: 1, h: 1 }, status: 'free' },
    { restaurantId: koiId, number: 2, seats: 2, position: { x: 1, y: 0, w: 1, h: 1 }, status: 'free' },
    { restaurantId: koiId, number: 3, seats: 4, position: { x: 2, y: 0, w: 2, h: 1 }, status: 'free' },
    { restaurantId: koiId, number: 4, seats: 4, position: { x: 0, y: 2, w: 2, h: 1 }, status: 'free' },
    { restaurantId: koiId, number: 5, seats: 4, position: { x: 2, y: 2, w: 2, h: 1 }, status: 'free' },
    { restaurantId: koiId, number: 6, seats: 6, position: { x: 4, y: 2, w: 2, h: 1 }, status: 'free' },
    { restaurantId: koiId, number: 7, seats: 2, position: { x: 0, y: 4, w: 1, h: 1 }, status: 'free' },
    { restaurantId: koiId, number: 8, seats: 2, position: { x: 1, y: 4, w: 1, h: 1 }, status: 'free' },
  ]
  koiTableDefs.forEach((t) => {
    const id = `tbl-koi-${t.number}`
    store.tables.set(id, { ...t, id })
  })

  // ── Sakura Menu ──────────────────────────────────────────────────────────
  const menuItems: Omit<MenuItem, 'id'>[] = [
    // Drinks
    { restaurantId: sakuraId, name: 'Matcha Latte', nameJa: '抹茶ラテ', category: 'drinks', price: 6.50, description: 'Ceremonial grade matcha with oat milk', imageColor: '#4a7c59', allergens: ['dairy'], isAvailable: true, isPopular: true, preparationTime: 5, ingredients: [{ key: 'tea', label: 'matcha', grams: 2 }, { key: 'milk', label: 'milk', grams: 200 }] },
    { restaurantId: sakuraId, name: 'Yuzu Lemonade', nameJa: '柚子レモネード', category: 'drinks', price: 7.00, description: 'Fresh yuzu citrus with sparkling water', imageColor: '#d4a017', allergens: [], isAvailable: true, preparationTime: 5, ingredients: [{ key: 'citrus', label: 'yuzu', grams: 60, europeanSeason: [11, 12, 1, 2] }, { key: 'sugar', label: 'sugar', grams: 20 }] },
    { restaurantId: sakuraId, name: 'Sapporo Beer', nameJa: 'サッポロビール', category: 'drinks', price: 8.50, description: 'Premium Japanese lager, 500ml', imageColor: '#8b6914', allergens: ['gluten'], isAvailable: true, isPopular: true, preparationTime: 2, ingredients: [{ key: 'beer', label: 'beer', grams: 330 }] },
    { restaurantId: sakuraId, name: 'Jasmine Tea', nameJa: 'ジャスミン茶', category: 'drinks', price: 4.50, description: 'Fragrant loose-leaf jasmine tea, pot', imageColor: '#b8d4a8', allergens: [], isAvailable: true, preparationTime: 5, ingredients: [{ key: 'tea', label: 'jasmine tea', grams: 3 }] },
    { restaurantId: sakuraId, name: 'Sake Selection', nameJa: '日本酒', category: 'drinks', price: 9.00, description: 'House sake, served warm or cold', imageColor: '#e8d5c4', allergens: ['gluten'], isAvailable: true, preparationTime: 3, ingredients: [{ key: 'sake', label: 'sake', grams: 150 }] },
    // Appetizers
    { restaurantId: sakuraId, name: 'Edamame', nameJa: '枝豆', category: 'appetizers', price: 5.50, description: 'Lightly salted steamed soybeans', imageColor: '#5a8a3a', allergens: ['soy'], isAvailable: true, isPopular: true, preparationTime: 8, ingredients: [{ key: 'soy', label: 'soybeans', grams: 120, europeanSeason: [7, 8, 9] }] },
    { restaurantId: sakuraId, name: 'Gyoza (6 pcs)', nameJa: '餃子', category: 'appetizers', price: 12.00, description: 'Pan-fried pork & vegetable dumplings', imageColor: '#c4814a', allergens: ['gluten', 'pork'], isAvailable: true, isPopular: true, spiceLevel: 1, preparationTime: 12, ingredients: [{ key: 'pork', label: 'pork', grams: 70 }, { key: 'wheat', label: 'wheat wrappers', grams: 60 }, { key: 'vegetable', label: 'cabbage', grams: 40, europeanSeason: [6, 7, 8, 9, 10, 11] }] },
    { restaurantId: sakuraId, name: 'Takoyaki (6 pcs)', nameJa: 'たこ焼き', category: 'appetizers', price: 13.50, description: 'Octopus balls with bonito flakes & mayo', imageColor: '#8b4513', allergens: ['gluten', 'fish', 'egg'], isAvailable: true, preparationTime: 15, ingredients: [{ key: 'fish', label: 'octopus', grams: 60, europeanSeason: [5, 6, 7, 8, 9] }, { key: 'wheat', label: 'batter', grams: 80 }, { key: 'egg', label: 'egg', grams: 20 }] },
    { restaurantId: sakuraId, name: 'Miso Soup', nameJa: '味噌汁', category: 'appetizers', price: 4.00, description: 'Traditional dashi broth with tofu & wakame', imageColor: '#8b6914', allergens: ['soy'], isAvailable: true, preparationTime: 5, ingredients: [{ key: 'soy', label: 'miso', grams: 25 }, { key: 'seaweed', label: 'wakame', grams: 5 }, { key: 'tofu', label: 'tofu', grams: 40 }] },
    // Mains
    { restaurantId: sakuraId, name: 'Tonkotsu Ramen', nameJa: '豚骨ラーメン', category: 'mains', price: 19.50, description: 'Rich pork bone broth, chashu, soft-boiled egg, nori', imageColor: '#c4884a', allergens: ['gluten', 'egg', 'pork'], isAvailable: true, isPopular: true, preparationTime: 20, ingredients: [{ key: 'pork', label: 'pork belly & broth', grams: 150 }, { key: 'wheat', label: 'ramen noodles', grams: 130 }, { key: 'egg', label: 'egg', grams: 50 }, { key: 'seaweed', label: 'nori', grams: 3 }] },
    { restaurantId: sakuraId, name: 'Chicken Katsu Curry', nameJa: 'チキンカツカレー', category: 'mains', price: 22.00, description: 'Crispy chicken cutlet with Japanese curry sauce', imageColor: '#d4a017', allergens: ['gluten', 'egg'], isAvailable: true, isPopular: true, spiceLevel: 2, preparationTime: 20, ingredients: [{ key: 'poultry', label: 'chicken', grams: 140 }, { key: 'rice', label: 'rice', grams: 180 }, { key: 'rootVegetable', label: 'carrot & onion', grams: 80, europeanSeason: [9, 10, 11, 12, 1, 2] }] },
    { restaurantId: sakuraId, name: 'Salmon Teriyaki', nameJa: 'サーモン照り焼き', category: 'mains', price: 24.50, description: 'Grilled salmon with house teriyaki, miso soup & rice', imageColor: '#e87461', allergens: ['fish', 'soy'], isAvailable: true, preparationTime: 18, ingredients: [{ key: 'fish', label: 'salmon', grams: 150 }, { key: 'rice', label: 'rice', grams: 150 }, { key: 'sugar', label: 'teriyaki glaze', grams: 15 }] },
    { restaurantId: sakuraId, name: 'Vegetable Udon', nameJa: '野菜うどん', category: 'mains', price: 17.00, description: 'Thick udon noodles in dashi broth with seasonal veg', imageColor: '#7ab87a', allergens: ['gluten', 'soy'], isAvailable: true, preparationTime: 15, ingredients: [{ key: 'wheat', label: 'udon noodles', grams: 150 }, { key: 'vegetable', label: 'seasonal vegetables', grams: 120, europeanSeason: [5, 6, 7, 8, 9, 10] }, { key: 'mushroom', label: 'shiitake', grams: 30, europeanSeason: [9, 10, 11] }] },
    { restaurantId: sakuraId, name: 'Chirashi Bowl', nameJa: 'ちらし寿司', category: 'mains', price: 26.00, description: 'Assorted sashimi over seasoned sushi rice', imageColor: '#ff9080', allergens: ['fish', 'soy'], isAvailable: true, preparationTime: 15, ingredients: [{ key: 'fish', label: 'assorted sashimi', grams: 120 }, { key: 'rice', label: 'sushi rice', grams: 180 }, { key: 'seaweed', label: 'nori', grams: 3 }] },
    // Desserts
    { restaurantId: sakuraId, name: 'Mochi Ice Cream (3 pcs)', nameJa: 'もちアイス', category: 'desserts', price: 9.00, description: 'Matcha, strawberry & vanilla filled mochi', imageColor: '#f0b8d0', allergens: ['dairy', 'gluten'], isAvailable: true, isPopular: true, preparationTime: 5, ingredients: [{ key: 'milk', label: 'ice cream', grams: 90 }, { key: 'rice', label: 'mochi', grams: 45 }, { key: 'sugar', label: 'sugar', grams: 20 }] },
    { restaurantId: sakuraId, name: 'Matcha Tiramisu', nameJa: '抹茶ティラミス', category: 'desserts', price: 8.50, description: 'Japanese twist on the classic, with ceremonial matcha', imageColor: '#4a7c59', allergens: ['dairy', 'egg', 'gluten'], isAvailable: true, preparationTime: 5, ingredients: [{ key: 'cheese', label: 'mascarpone', grams: 70 }, { key: 'egg', label: 'egg', grams: 30 }, { key: 'tea', label: 'matcha', grams: 3 }, { key: 'sugar', label: 'sugar', grams: 25 }] },
  ]

  const menuIds: string[] = []
  menuItems.forEach((item, i) => {
    const id = `menu-sakura-${i + 1}`
    menuIds.push(id)
    store.menuItems.set(id, { ...item, id })
  })

  // ── Koi Menu (abbreviated) ───────────────────────────────────────────────
  const koiMenu: Omit<MenuItem, 'id'>[] = [
    { restaurantId: koiId, name: 'Shoyu Ramen', nameJa: '醤油ラーメン', category: 'mains', price: 15.50, description: 'Classic soy-based broth ramen', imageColor: '#8b4513', allergens: ['gluten', 'soy'], isAvailable: true, isPopular: true, preparationTime: 15, ingredients: [{ key: 'poultry', label: 'chicken broth', grams: 120 }, { key: 'wheat', label: 'ramen noodles', grams: 130 }, { key: 'egg', label: 'egg', grams: 50 }, { key: 'seaweed', label: 'nori', grams: 3 }] },
    { restaurantId: koiId, name: 'Spicy Miso Ramen', nameJa: '辛味噌ラーメン', category: 'mains', price: 16.50, description: 'Rich miso broth with chili oil', imageColor: '#cc3300', allergens: ['gluten', 'soy'], isAvailable: true, spiceLevel: 3, preparationTime: 15, ingredients: [{ key: 'soy', label: 'miso', grams: 30 }, { key: 'pork', label: 'pork', grams: 80 }, { key: 'wheat', label: 'ramen noodles', grams: 130 }, { key: 'vegetable', label: 'corn & spring onion', grams: 50, europeanSeason: [7, 8, 9] }] },
    { restaurantId: koiId, name: 'Gyoza (6 pcs)', nameJa: '餃子', category: 'appetizers', price: 10.00, description: 'House pan-fried dumplings', imageColor: '#c4814a', allergens: ['gluten'], isAvailable: true, preparationTime: 12 },
    { restaurantId: koiId, name: 'Sapporo Beer', nameJa: 'サッポロビール', category: 'drinks', price: 7.50, description: 'Japanese lager 500ml', imageColor: '#8b6914', allergens: ['gluten'], isAvailable: true, preparationTime: 2 },
    { restaurantId: koiId, name: 'Green Tea', nameJa: '緑茶', category: 'drinks', price: 3.50, description: 'Free-refill green tea', imageColor: '#4a7c59', allergens: [], isAvailable: true, preparationTime: 3, ingredients: [{ key: 'tea', label: 'green tea', grams: 3 }] },
  ]
  koiMenu.forEach((item, i) => {
    const id = `menu-koi-${i + 1}`
    store.menuItems.set(id, { ...item, id })
  })

  // ── Pre-seeded Orders & Table States ────────────────────────────────────
  // Table 3 - occupied (ordered 40 min ago, food order)
  const order3Id = uuid()
  const t3 = store.tables.get(tableIds[2])!
  const order3: Order = {
    id: order3Id,
    tableId: t3.id, tableNumber: 3, restaurantId: sakuraId,
    items: [
      { menuItemId: menuIds[9], name: 'Tonkotsu Ramen', nameJa: '豚骨ラーメン', quantity: 2, price: 19.50, type: 'food', preparationTime: 20 },
      { menuItemId: menuIds[2], name: 'Sapporo Beer', nameJa: 'サッポロビール', quantity: 2, price: 8.50, type: 'drink', preparationTime: 2 },
    ],
    status: 'served', totalAmount: 56.00,
    paymentStatus: 'unpaid',
    createdAt: minutesAgo(40), updatedAt: minutesAgo(25),
    estimatedServeTime: minutesAgo(20),
  }
  store.orders.set(order3Id, order3)
  store.tables.set(t3.id, {
    ...t3, status: 'occupied',
    session: { startTime: minutesAgo(40), expectedEndTime: minutesFromNow(20), orderId: order3Id, paymentStatus: 'unpaid' }
  })

  // Table 6 - occupied (food ordered 25 min ago)
  const order6Id = uuid()
  const t6 = store.tables.get(tableIds[5])!
  const order6: Order = {
    id: order6Id,
    tableId: t6.id, tableNumber: 6, restaurantId: sakuraId,
    items: [
      { menuItemId: menuIds[10], name: 'Chicken Katsu Curry', nameJa: 'チキンカツカレー', quantity: 3, price: 22.00, type: 'food', preparationTime: 20 },
      { menuItemId: menuIds[0], name: 'Matcha Latte', nameJa: '抹茶ラテ', quantity: 3, price: 6.50, type: 'drink', preparationTime: 5 },
      { menuItemId: menuIds[5], name: 'Edamame', nameJa: '枝豆', quantity: 2, price: 5.50, type: 'food', preparationTime: 8 },
    ],
    status: 'served', totalAmount: 89.00,
    paymentStatus: 'unpaid',
    createdAt: minutesAgo(25), updatedAt: minutesAgo(10),
    estimatedServeTime: minutesFromNow(5),
  } as Order
  store.orders.set(order6Id, order6)
  store.tables.set(t6.id, {
    ...t6, status: 'occupied',
    session: { startTime: minutesAgo(25), expectedEndTime: minutesFromNow(35), orderId: order6Id, paymentStatus: 'unpaid' }
  })

  // Table 4 - payment_pending
  const order4Id = uuid()
  const t4 = store.tables.get(tableIds[3])!
  const order4: Order = {
    id: order4Id,
    tableId: t4.id, tableNumber: 4, restaurantId: sakuraId,
    items: [
      { menuItemId: menuIds[11], name: 'Salmon Teriyaki', nameJa: 'サーモン照り焼き', quantity: 2, price: 24.50, type: 'food', preparationTime: 18 },
      { menuItemId: menuIds[3], name: 'Jasmine Tea', nameJa: 'ジャスミン茶', quantity: 2, price: 4.50, type: 'drink', preparationTime: 5 },
    ],
    status: 'served', totalAmount: 58.00,
    paymentStatus: 'unpaid',
    createdAt: minutesAgo(75), updatedAt: minutesAgo(5),
    estimatedServeTime: minutesAgo(50),
  }
  store.orders.set(order4Id, order4)
  store.tables.set(t4.id, {
    ...t4, status: 'payment_pending',
    session: { startTime: minutesAgo(75), expectedEndTime: minutesFromNow(0), orderId: order4Id, paymentStatus: 'unpaid' }
  })

  console.log('✅ Seed data loaded — Sakura & Koi restaurants ready')
}
