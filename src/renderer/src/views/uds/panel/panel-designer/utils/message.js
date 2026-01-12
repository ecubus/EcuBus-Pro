import {ElMessage} from 'element-plus';


const message = (msg, type, id) => {
    return ElMessage({
        message: msg,
        plain: true,
        offset: 30,
        type: type || 'info',
        customClass: '_fc-message-tip',
        appendTo: id
    });
};

const errorMessage = (msg, id) => {
    return message(msg, 'error', id);

};

export default errorMessage;

export {message}
