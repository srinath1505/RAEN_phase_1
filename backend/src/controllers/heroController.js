const prisma = require('../config/db');
const { success, error } = require('../utils/apiResponse');

// Public: returns all active slides ordered by position
exports.getSlides = async (req, res) => {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' }
    });
    return success(res, { slides }, 'Hero slides retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Admin: get all slides (active + inactive)
exports.adminGetSlides = async (req, res) => {
  try {
    const slides = await prisma.heroSlide.findMany({ orderBy: { position: 'asc' } });
    return success(res, { slides }, 'Hero slides retrieved');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Admin: create slide
exports.createSlide = async (req, res) => {
  try {
    const { position, imageUrl, tag, headline, sub, ctaText, ctaUrl, isActive } = req.body;
    if (!imageUrl || !headline) return error(res, 'imageUrl and headline are required', 400);
    const slide = await prisma.heroSlide.create({
      data: {
        position: parseInt(position) || 1,
        imageUrl,
        tag: tag || '',
        headline,
        sub: sub || '',
        ctaText: ctaText || 'Discover the Piece',
        ctaUrl: ctaUrl || 'collections.html',
        isActive: isActive !== false
      }
    });
    return success(res, { slide }, 'Hero slide created', 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Admin: update slide
exports.updateSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const { position, imageUrl, tag, headline, sub, ctaText, ctaUrl, isActive } = req.body;
    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        ...(position !== undefined && { position: parseInt(position) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(tag !== undefined && { tag }),
        ...(headline !== undefined && { headline }),
        ...(sub !== undefined && { sub }),
        ...(ctaText !== undefined && { ctaText }),
        ...(ctaUrl !== undefined && { ctaUrl }),
        ...(isActive !== undefined && { isActive })
      }
    });
    return success(res, { slide }, 'Hero slide updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
};

// Admin: delete slide
exports.deleteSlide = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.heroSlide.delete({ where: { id } });
    return success(res, null, 'Hero slide deleted');
  } catch (err) {
    return error(res, err.message, 400);
  }
};
