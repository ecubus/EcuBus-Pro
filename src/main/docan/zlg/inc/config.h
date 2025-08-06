#ifndef ZLG_CONFIG_INTF_H
#define ZLG_CONFIG_INTF_H

struct _Meta;
struct _Pair;
struct _Options;
struct _ConfigNode;

typedef struct _Meta Meta;
typedef struct _Pair Pair;
typedef struct _Options Options;
typedef struct _ConfigNode ConfigNode;

/**
*  \struct Options
* 节点mata的可选项。
*/
struct _Options
{
    /*! 可选项的数据类型*/
    const char * type;

    /*! 可选项的值*/
    const char * value;

    /*! 可选项的描述信息*/
    const char * desc;
};

/**
*  \struct Meta
* 节点mata信息。
*/
struct _Meta
{
    /*! 配置项的数据类型 */
    const char * type;

    /*! 配置项的说明性信息 */
    const char * desc;

    /*! 配置项是否是只读的，缺省为可读写 */
    int read_only;

    /*! 配置项输入格式的提示 */
    const char * format;

    /*! 对于数值类型的配置项来说是最小值，对字符串的配置项来说是最小长度（字节数）。 */
    double min_value;

    /*! 对于数值类型的配置项来说是最大值，对字符串的配置项来说是最大长度（字节数）。 */
    double max_value;

    /*! 配置项的单位 */
    const char * unit;

    /*! 通过旋钮/滚轮等方式修改配置项时的增量 */
    double delta;

    /*! 配置项是否可见, true可见，false不可见，也可以绑定表达式（表达式使用参考demo3），缺省可见 */
    const char* visible;

    /*! 该配置项是否使能, true使能，false不使能，也可以绑定表达式（表达式使用参考demo3）。缺省使能 */
    const char* enable;

    /*! 配置项的可选值，仅但『type』为间接类型时有效 */
    int editable;

    /*! 配置项的可选值，仅但『type』为间接类型时有效，以NULL结束 */
    Options** options;
};

/**
*  \struct Pair
*  属性的KeyValue对。
*/
struct _Pair
{
    const char * key;
    const char * value;
};

/**
*  \struct ConfigNode 
*  ConfigNode
*/
struct _ConfigNode
{
    /*! 节点的名字 */
    const char * name;
    /*! 节点的值 同样可以绑定表达式*/
    const char * value;
    /*! 节点值的表达式，当有该表达式时，value由此表达式计算而来*/
    const char* binding_value;
    /*! 该节点的路径 */
    const char * path;
    /*! 配置项信息 */
    Meta* meta_info;
    /*! 该节点的子节点, 以NULL结束*/
    ConfigNode** children;
    /*! 该节点的属性, 以NULL结束*/
    Pair** attributes;
};

/**
* \brief 获取属性的描述信息。
*
* \retval ConfigNode
*/
typedef const ConfigNode* (*GetPropertysFunc)();

/**
* \brief 设置指定路径的属性的值。
* \param[in] path  : 属性的路径。
* \param[in] value : 属性的值。
*
* \retval 成功返回1，失败返回0。
*/
typedef int (*SetValueFunc)(const char* path, const char* value);

/**
* \brief 获取指定路径的属性的值。
* \param[in] path  : 属性的路径。
* \retval 成功返回属性的值，失败返回NULL。
*/
typedef const char* (*GetValueFunc)(const char* path);

typedef struct  tagIProperty
{
    SetValueFunc     SetValue;
    GetValueFunc     GetValue;
    GetPropertysFunc GetPropertys;
}IProperty;

#endif /*ZLG_CONFIG_INTF_H*/

