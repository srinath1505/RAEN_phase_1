const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const products = [
  {
    slug: 'bare-obsession',
    name: 'Bare Obsession',
    description: 'An illusion of bare skin weaponized in crystal. Hand-placed rhinestones create a second-skin sheath that blurs the line between dressed and exposed. Hand-finished in our northern atelier.',
    category: 'The Icons Collection',
    price: 3900.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/nude rhinestone/1 (1).avif',
      'public/images/nude rhinestone/1 (2).avif',
      'public/images/nude rhinestone/1 (3).avif',
      'public/images/nude rhinestone/1 (4).avif',
      'public/images/nude rhinestone/1 (5).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'black-pearl',
    name: 'Black Pearl',
    description: 'Luminous black pearls cascade over liquid silk. A devastating silhouette that weaponizes elegance and transforms the body into pure power.',
    category: 'Atelier Collection',
    price: 3600.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/black pearl/1 (1).avif',
      'public/images/black pearl/1 (2).avif',
      'public/images/black pearl/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'crimson-vice',
    name: 'Crimson Vice',
    description: 'Relentless shine and floor-length drama. Thousands of micro-sequins reflect light like wet blood, creating a silhouette that is both provocative and devastatingly precise.',
    category: 'Statement Piece',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/maroon sequin/1 (1).avif',
      'public/images/maroon sequin/1 (2).avif',
      'public/images/maroon sequin/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'emerald-sin',
    name: 'Emerald Sin',
    description: 'Deep emerald sequins catch light with dangerous intent. A skin-tight column of pure provocation engineered for maximum impact.',
    category: 'Statement Piece',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/teal sequin/1 (1).avif',
      'public/images/teal sequin/1 (2).avif',
      'public/images/teal sequin/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'midnight-venom',
    name: 'Midnight Venom',
    description: 'Obsidian black lace drapes the body like liquid shadow. Intricate detailing meets dangerous allure in this floor-length statement of power.',
    category: 'Atelier Collection',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/black lace/1 (1).avif',
      'public/images/black lace/1 (2).avif',
      'public/images/black lace/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'poison-kiss',
    name: 'Poison Kiss',
    description: 'Chocolate brown lace engineered for seduction. Every detail designed to provoke, every cut calculated to command absolute attention.',
    category: 'Statement Piece',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/brown lace/1 (1).avif',
      'public/images/brown lace/1 (2).avif',
      'public/images/brown lace/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'serpentine',
    name: 'Serpentine',
    description: 'Olive silk drapes with predatory precision. A halter-neck masterpiece that weaponizes elegance and redefines luxury.',
    category: 'Atelier Collection',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/olive halter neck/1(1).avif',
      'public/images/olive halter neck/1(2).avif',
      'public/images/olive halter neck/1(3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'taupe-wrap',
    name: 'Taupe Wrap',
    description: 'Liquid taupe silk engineered for movement. Asymmetric wrapping creates a devastating silhouette that moves with dangerous grace.',
    category: 'Statement Piece',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/taupe wrap/1 (1).avif',
      'public/images/taupe wrap/1 (2).avif',
      'public/images/taupe wrap/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'the-ivory-weapon',
    name: 'The Ivory Weapon',
    description: 'Iridescent white pearls cascade down liquid ivory silk. Pure elegance weaponized into a devastating statement of power and precision.',
    category: 'Atelier Collection',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/white pearl/1 (1).avif',
      'public/images/white pearl/1 (2).avif',
      'public/images/white pearl/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'the-provocateur',
    name: 'The Provocateur',
    description: 'Dramatic maroon halter neck engineered for maximum impact. Asymmetric cuts and dangerous draping create a silhouette of pure provocation.',
    category: 'Statement Piece',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/maroon halter/1 (1).avif',
      'public/images/maroon halter/1 (2).avif',
      'public/images/maroon halter/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'the-sovereign',
    name: 'The Sovereign',
    description: 'Deep burgundy rhinestones create a second skin of absolute luxury. Hand-placed crystals catch light with regal intensity in this floor-length masterpiece.',
    category: 'Atelier Collection',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/burgundy rhinestone/1 (1).avif',
      'public/images/burgundy rhinestone/1 (2).avif',
      'public/images/burgundy rhinestone/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  },
  {
    slug: 'velvet-scandal',
    name: 'Velvet Scandal',
    description: 'Rich teal wrap dress engineered in liquid silk. Asymmetric design meets dangerous elegance in this statement of unapologetic luxury.',
    category: 'Statement Piece',
    price: 1450.00,
    currency: 'EUR',
    status: 'ACTIVE',
    images: JSON.stringify([
      'public/images/teal wrap/1 (1).avif',
      'public/images/teal wrap/1 (2).avif',
      'public/images/teal wrap/1 (3).avif'
    ]),
    sizes: JSON.stringify(['XS', 'S', 'M', 'L'])
  }
];

async function main() {
  console.log('🌱 Starting seed...');

  // Create Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@raen.design';
  const adminPassword = process.env.ADMIN_PASSWORD || 'RaenAdmin2024!';
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.create({
      data: {
        firstName: 'RAEN',
        lastName: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN'
      }
    });
    
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
  }

  // Seed Products
  for (const productData of products) {
    const existingProduct = await prisma.product.findUnique({
      where: { slug: productData.slug }
    });

    if (!existingProduct) {
      const product = await prisma.product.create({
        data: productData
      });

      console.log(`✅ Created product: ${product.name}`);

      // Create inventory for each size
      const sizes = JSON.parse(productData.sizes);
      for (const size of sizes) {
        await prisma.inventory.create({
          data: {
            productId: product.id,
            size,
            stock: 10, // Default stock
            reservedStock: 0,
            sku: `${productData.slug.toUpperCase()}-${size}`
          }
        });
      }

      console.log(`  ✅ Created inventory for sizes: ${sizes.join(', ')}`);
    } else {
      console.log(`ℹ️  Product already exists: ${productData.name}`);
    }
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
