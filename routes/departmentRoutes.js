const express = require('express');
const router = express.Router();
const { getDepartments, createDepartment, deleteDepartment, updateDepartment } = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/authMiddleware'); // authorize для POST/PATCH/DELETE

router.route('/')
  .get(protect, getDepartments)
  .post(protect, authorize('admin'), createDepartment);

router.route('/:id')
  .patch(protect, authorize('admin'), updateDepartment) // Додаємо маршрут для оновлення
  .delete(protect, authorize('admin'), deleteDepartment);

module.exports = router;