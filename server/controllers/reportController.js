const mongoose = require('mongoose');
const Report = require('../models/Report');
const User = require('../models/User');
const Store = require('../models/Store');

const REPORT_TYPES = ['abusive_message', 'fake_listing', 'no_show', 'other'];

// USER: file a report against a user or a store.
exports.createReport = async (req, res) => {
  try {
    const { reportedUser, reportedStore, type, reason } = req.body;

    if (!REPORT_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid report type.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'Please tell us what happened.' });
    }
    if (!reportedUser && !reportedStore) {
      return res.status(400).json({ message: 'Who or what are you reporting?' });
    }
    if (reportedUser && !mongoose.isValidObjectId(reportedUser)) {
      return res.status(400).json({ message: 'Invalid user.' });
    }
    if (reportedStore && !mongoose.isValidObjectId(reportedStore)) {
      return res.status(400).json({ message: 'Invalid store.' });
    }
    if (reportedUser && String(reportedUser) === String(req.userId)) {
      return res.status(400).json({ message: 'You cannot report yourself.' });
    }

    // Stop spam: only one pending report per reporter + target + type.
    const duplicate = await Report.findOne({
      reporter: req.userId,
      reportedUser: reportedUser || null,
      reportedStore: reportedStore || null,
      type,
      status: 'pending',
    });
    if (duplicate) {
      return res.status(409).json({ message: 'You already have a pending report for this.' });
    }

    const report = await Report.create({
      reporter: req.userId,
      reportedUser: reportedUser || undefined,
      reportedStore: reportedStore || undefined,
      type,
      reason: String(reason).trim().slice(0, 1000),
    });

    res.status(201).json({ message: 'Report sent. An admin will review it.', report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

// USER: reports I filed.
exports.myReports = async (req, res) => {
  try {
    const reports = await Report.find({ reporter: req.userId })
      .populate('reportedUser', 'name role')
      .populate('reportedStore', 'name')
      .sort('-createdAt');
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

// ADMIN: list reports. Optional filters: ?status=pending&type=no_show
exports.listReports = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;

    const reports = await Report.find(filter)
      .populate('reporter', 'name email role')
      .populate('reportedUser', 'name email role banned mutedUntil warnings')
      .populate('reportedStore', 'name status owner')
      .sort('-createdAt');

    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};

// ADMIN: resolve a report with one action: dismiss | warn | mute | remove
exports.resolveReport = async (req, res) => {
  try {
    const { action, adminNote, muteDays } = req.body;

    if (!['dismiss', 'warn', 'mute', 'remove'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action.' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    if (report.status !== 'pending') {
      return res.status(400).json({ message: 'This report is already resolved.' });
    }

    const note = String(adminNote || '').trim();

    if (action === 'dismiss') {
      report.status = 'dismissed';
      report.action = 'none';
    } else {
      const store = report.reportedStore ? await Store.findById(report.reportedStore) : null;

      // Warn/mute go to a person. If only a store was reported, that person is its owner.
      let targetUser = null;
      if (report.reportedUser) {
        targetUser = await User.findById(report.reportedUser);
      } else if (store) {
        targetUser = await User.findById(store.owner);
      }

      if (action === 'remove') {
        // Remove = ban. A reported store is suspended; a reported user is banned.
        if (!store && !targetUser) {
          return res.status(404).json({ message: 'Nothing to remove.' });
        }
        if (store) {
          store.status = 'banned';
          store.banReason = note || 'Removed after a report.';
          store.bannedAt = new Date();
          await store.save();
        }
        if (report.reportedUser && targetUser) {
          if (targetUser.role === 'admin') {
            return res.status(400).json({ message: 'You cannot remove an admin.' });
          }
          targetUser.banned = true;
          targetUser.banReason = note || 'Removed after a report.';
          targetUser.bannedAt = new Date();
          await targetUser.save();
        }
      } else {
        if (!targetUser) {
          return res.status(404).json({ message: 'User not found.' });
        }
        if (targetUser.role === 'admin') {
          return res.status(400).json({ message: 'You cannot act on an admin.' });
        }

        if (action === 'warn') {
          targetUser.warnings.push({
            message: note || 'You received a warning from the admin.',
            by: req.userId,
          });
        } else if (action === 'mute') {
          const days = Math.min(Math.max(Number(muteDays) || 3, 1), 365);
          targetUser.mutedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }
        await targetUser.save();
      }

      report.status = 'actioned';
      report.action = action;
    }

    report.adminNote = note;
    report.resolvedBy = req.userId;
    report.resolvedAt = new Date();
    await report.save();

    res.json({ message: 'Report resolved.', report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};