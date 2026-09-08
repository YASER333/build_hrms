import mongoose from 'mongoose';

const toTitleCase = (str) => {
    if (!str) return str;
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const menuSchema = new mongoose.Schema({
    menuName:{
        type:String,
        required:true,
        set: toTitleCase,
        match: [/^[A-Za-z ]+$/, "menuName must contain only alphabets"]
    },
    menuCode:{
        type:String,
        required:true,
        unique:true
    },
    isActive:{
        type:Boolean,
        default:true
    },
    isBlock:{
        type:Boolean,
        default:false
    }
  },{
        timestamps:true
     });


     menuSchema.pre("validate", async function (next) {
    if (!this.menuCode && this.menuName) {
        const prefix = this.menuName.toUpperCase().replace(/\s+/g, "_");
        const count = await this.constructor.countDocuments({
            menuName: this.menuName
        });
        const number = String(count + 1).padStart(4, "0");
        this.menuCode = `${prefix}_${number}`;
    }
    next();
});


const Menu = mongoose.model('Menu' , menuSchema);
export default Menu;