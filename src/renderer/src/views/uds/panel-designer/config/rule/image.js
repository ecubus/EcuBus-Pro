import {localeProps} from '../../utils';

const label = '图片';
const name = 'LocalImage';

export default {
    menu: 'aide',
    icon: 'icon-image',
    label,
    name,
    rule() {
        return {
            type: name,
            title: '',
            style: {
                width: '100px',
                height: '100px',
            },
            props: {
                src: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/img/logo256.png',
            }
        };
    },
    props(_, {t}) {
        return localeProps(t, name + '.props', [
            {
                type: 'ChooseFile',
                field: 'src',
            }
        ]);
    }
};
