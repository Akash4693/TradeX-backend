const express = require("express");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const Shop = require("../model/shop");
const Event = require("../model/event");
const ErrorHandler = require("../utils/ErrorHandler");
const { isSeller, isAdmin, isAuthenticated } = require("../middleware/auth");
const router = express.Router();
const cloudinary = require("cloudinary");

// create event
router.post(
  "/create-event",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const shopId = req.body.shopId;
      const shop = await Shop.findById(shopId);
      if (!shop) {
        return next(new ErrorHandler("Shop Id is invalid!", 400));
      } else {
        let images = [];

        if (typeof req.body.images === "string") {
          images.push(req.body.images);
        } else {
          images = req.body.images;
        }

        const imagesLinks = [];

        for (let i = 0; i < images.length; i++) {
          const result = await cloudinary.v2.uploader.upload(images[i], {
            folder: "products",
          });

          imagesLinks.push({
            public_id: result.public_id,
            url: result.secure_url,
          });
        }

        const productData = req.body;
        productData.images = imagesLinks;
        productData.shop = shop;

        console.log("productData", productData);

        const event = await Event.create(productData);
        console.log("event", event);
        console.log("event created successfully");
        res.status(201).json({
          success: true,
          event,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// get all events
router.get("/get-all-events", async (req, res, next) => {
  try {
    const events = await Event.find();
    res.status(201).json({
      success: true,
      events,
    });
  } catch (error) {
    return next(new ErrorHandler(error, 400));
  }
});

// get all events of a shop
router.get(
  "/get-all-events/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const events = await Event.find({ shopId: req.params.id });

      res.status(201).json({
        success: true,
        events,
      });
    } catch (error) {
      return next(new ErrorHandler(error, 400));
    }
  })
);

// delete event of a shop
router.delete(
  "/delete-shop-event/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // Find the event by ID
      const event = await Event.findById(req.params.id);
      console.log(event);

      // Check if the event exists
      if (!event) {
        return next(new ErrorHandler("Event is not found with this id", 404));
      }

      // Use Promise.all to delete all images concurrently
      const imageDeletionPromises = event.images.map((image) =>
        cloudinary.v2.uploader.destroy(image.public_id)
      );

      // Wait for all deletions to complete
      const deletionResults = await Promise.all(imageDeletionPromises);

      // Log the results of image deletions
      deletionResults.forEach((result, index) => {
        console.log(`Image ${index} deletion result:`, result);
        if (result.result !== 'ok') {
          console.error(`Failed to delete image with public_id: ${event.images[index].public_id}`);
        }
      });

      // Delete the event from the database
      const deleteResult = await Event.deleteOne({ _id: req.params.id });

      // Check if the deletion was successful
      if (deleteResult.deletedCount === 0) {
        return next(new ErrorHandler("Failed to delete the event", 400));
      }

      console.log("Event removed successfully from the database.");

      // Respond with success
      res.status(200).json({
        success: true,
        message: "Event Deleted successfully!",
      });
    } catch (error) {
      // Handle errors
      return next(new ErrorHandler(error.message || "Server Error", 400));
    }
  })
);


// all events --- for admin
router.get(
  "/admin-all-events",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const events = await Event.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        events,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
