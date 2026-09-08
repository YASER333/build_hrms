import mongoose from 'mongoose';

const toTitleCase = (str) => {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const currentCompanySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    companyName: {
      type: String,
      default: '',
      required: function () {
        return !this.isFresher;
      },
      trim: true,
      set: toTitleCase,
    },

    companyWebsite: {
      type: String,
      default: '',
      required: function () {
        return !this.isFresher;
      },
      trim: true,
    },

    department: {
      type: String,
      default: '',
      required: function () {
        return !this.isFresher;
      },
      trim: true,
      set: toTitleCase,
    },

    designation: {
      type: String,
      default: '',
      required: function () {
        return !this.isFresher;
      },
      trim: true,
      set: toTitleCase,
    },

    role: {
      type: String,
      default: '',
      required: function () {
        return !this.isFresher;
      },
      trim: true,
      set: toTitleCase,
    },

    salary: {
      type: String,
      default: '0',
      required: function () {
        return !this.isFresher;
      },
      trim: true,
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    reportedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: true,
    },

    noticePeriod: {
      type: String,
      default: '',
      required: function () {
        return !this.isFresher;
      },
      trim: true,
    },

    expectedLastWorkingDate: {
      type: Date,
      default: null,
      required: function () {
        return !this.isFresher;
      },
    },

    isFresher: {
      type: Boolean,
      default: false,
    },

    employmentStatus: {
      type: String,
      enum: [
        'CURRENTLY_EMPLOYED',
        'RESIGNED',
        'RELIEVED',
        'NOT_APPLICABLE',
      ],
      default: 'CURRENTLY_EMPLOYED',
    },

    // Optional Flat Document Upload URLs
    experienceLetter: {
      type: String,
      default: '',
      required: false,
    },
    experienceLetterUrl: {
      type: String,
      default: '',
      required: false,
    },
    payslip: {
      type: String,
      default: '',
      required: false,
    },
    payslipUrl: {
      type: String,
      default: '',
      required: false,
    },
    relievingLetter: {
      type: String,
      default: '',
      required: false,
    },
    relievingLetterUrl: {
      type: String,
      default: '',
      required: false,
    },
    documentUrl: {
      type: String,
      default: '',
      required: false,
    },
    documentType: {
      type: String,
      default: '',
      required: false,
    },

    documents: [
      {
        documentType: {
          type: String,
          enum: [
            'CURRENT_EMPLOYMENT_LETTER',
            'OFFER_LETTER',
            'APPOINTMENT_LETTER',
            'PAYSLIP',
            'RESIGNATION_ACKNOWLEDGEMENT',
            'EXPERIENCE_LETTER',
            'RELIEVING_LETTER',
            'OTHER',
          ],
          required: true,
        },

        fileUrl: {
          type: String,
          required: true,
        },

        fileName: {
          type: String,
          default: '',
        },

        uploadedAt: {
          type: Date,
          default: Date.now,
        },

        verificationStatus: {
          type: String,
          enum: ['PENDING', 'VERIFIED', 'REJECTED'],
          default: 'PENDING',
        },

        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },

        verifiedAt: {
          type: Date,
          default: null,
        },

        rejectionReason: {
          type: String,
          default: '',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const CurrentCompany = mongoose.model('CurrentCompany', currentCompanySchema);

export default CurrentCompany;
