/**
 * MVVM模式框架
 * 1.ES6的类
 * 2.模板元素节点$el
 * 3.生成虚拟dom

 * 4.根据虚拟dom重新生成节点
 * 5.把节点的插值表达式内容替换为data的属性值 

 * 6.data数据劫持，监听数据变化更新
 * 7.双向数据绑定 v-model
 */

class Vm {
  constructor(config) {
    // 初始化参数,目的是为了参数可能会出错
    config = {
      el: "",
      data: {},
      methods: {},
      created: () => {},
      mounted: () => {},
      ...config,
    };

    // 把模板元素节点绑定到实例的$el属性
    this.$el = document.querySelector(config.el);
    if (!this.$el) {
      throw new Error("组件的DOM根元素不能为空");
    }

    // 把methods下的函数添加给实例当做是实例下的方法
    Object.keys(config.methods).forEach((key) => {
      this[key] = config.methods[key];
    });

    // Object.keys会返回由对象的key组成的数组
    var keysArr = Object.keys(config.data);

    // 循环config.data的属性，把属性绑定到this (这种方式在修改实例属性时候无法监听)
    // keysArr.forEach(key => {
    //     this[key] = config.data[key];
    // });

    // 循环通过Object.defineProperty来监听属性的变化
    keysArr.forEach((key) => {
      // value是data属性的值
      var value = config.data[key];

      Object.defineProperty(this, key, {
        get: () => {
          return value;
        },
        // set的参数是该属性赋的新值
        set: (newValue) => {
          // 替换原来旧的值
          value = newValue;

          console.log(key + "被修改了");
          // 当监听到某个属性发生了变化，就执行局部刷新
          this.updateElementText(key);
        },
      });
    });

    // 组件刚刚创建时候执行create
    config.created.call(this);

    // 生成虚拟dom(用对象或者数组的方式来描述节点)
    this.complierNodes();

    // 根据虚拟dom重新创建新的dom节点
    this.createElement();

    // dom结构加载完毕后执行mounted
    config.mounted.apply(this);
  }

  /**
   * 生成虚拟dom
   *
   * [{
   *  node:HTMLELEMENT,
   *  nodeName: DOCUMENT_NODE_NAME,
   *  nodeValue: DOCUMENT_NODE_VALUE,
   *  attrs:  ATTRIBUTES,
   *  data: MODEL_DATA,
   *  children: SELF
   * }]
   */
  complierNodes() {
    // 根节点的dom元素下的所有子节点
    var nodeList = this.$el.childNodes;

    // 这个写法不能获取到没有标签包起来的文字
    // var nodeList2 = this.$el.children;

    this.$vmNodes = this.complierNodesChild(nodeList);

    console.log(this.$vmNodes);
  }

  /**
   * 递归生成虚拟dom的函数
   */
  complierNodesChild(nodeList) {
    // 最终要放回的数组
    var vmNodes = [];
    // 数组中要存放我们拼接的数据
    var data = {};

    [...nodeList].forEach((node) => {
      // 当节点是一个文本节点，也就是nodeName等于#text，并且nodeValue值是空的就直接返回
      if (node.nodeName === "#text" && node.nodeValue.trim() === "") {
        return false;
      }

      // 如果是可用的节点
      data = {
        node: node, // 存放节点元素
        nodeName: node.nodeName, // 节点的名字
        nodeValue: node.nodeValue, // 元素的值
        nodeType: node.nodeType, // 元素节点类型, 1代表普通元素，3代表文本节点，8代表注释
        data: [], // 存放节点中的插值表达式的内容
        attrs: node.attributes, // 元素节点的属性
        props: {}, // 除了v-开头的剩下的属性
        directives: {}, // 专门存放指令的数组
        children: [],
        events: {}, // 存放节点的事件
      };

      var attrObj = { ...node.attributes };
      Object.keys(attrObj).forEach((index) => {
        var prop = attrObj[index];

        // 判断属性是否是v-开头的
        if (/^(v-)+/.test(prop.name)) {
          // 把指令保存到data的direactives
          data.directives[prop.name] = prop.value;
        } else if (/^(@)+/.test(prop.name)) {
          // 如果是以@开头的属性，说明他是一个事件
          data.events[prop.name.replace("@", "")] = prop.value;
        } else {
          // 把非v-开头的属性添加给data.props
          data.props[prop.name] = prop.value;
        }
      });

      // 把文本节点中的带有插值表达式的内容提取到data中
      // 有些节点的nodeVlue等于null，所以要过滤掉
      if (node.nodeValue) {
        // 匹配字符串中插值表达式的内容
        var reg = /\{\{[^\{\}]*\}\}/g;
        // 字符串的match方法会根据正则返回一个数组
        var arr = node.nodeValue.match(reg) || [];

        // 循环去掉大括号
        arr.forEach((v) => {
          // v = message
          v = v.replace(/[\{\}]/g, "");
          data.data.push(v);
        });
      }

      // 证明有子元素, ，如果有的话循环递归执行当前的这个函数
      if (node.childNodes.length > 0) {
        // 难理解的点，要知道当前的函数会返回一个数组，该数组要赋值给children
        data.children = this.complierNodesChild(node.childNodes);
      }

      vmNodes.push(data);
    });

    return vmNodes;
  }

  /**
   * 根据虚拟dom重新生成节点
   */
  createElement() {
    // 创建一个虚拟的模板节点（文档片段）
    var fragment = document.createDocumentFragment();

    // 返回最后所有虚拟节点生成的dom元素
    this.createElementChild(fragment, this.$vmNodes);

    // 清空根节点所有的内容
    this.$el.innerHTML = "";

    // 重新生成dom元素
    this.$el.appendChild(fragment);
  }

  /**
   * 递归生成子节点
   *
   * parentNode 代表父元素
   * nodeList 代表虚拟dom里面的children -> [p, span]
   */
  createElementChild(parentNode, nodeList) {
    // 循环虚拟node节点重新生成dom元素
    nodeList.forEach((node) => {
      var newNode;

      // 如果是元素节点（非文本节点）使用createElement
      if (node.nodeType === 1) {
        newNode = document.createElement(node.nodeName);

        // 因为只有元素节点才会有事件，所以在这个if判断中添加事件
        // eventName = click
        Object.keys(node.events).forEach((eventName) => {
          newNode.addEventListener(eventName, (event) => {
            // node.events[eventName] = handleClick
            this[node.events[eventName]](event);
          });
        });
      }

      // 文本节点
      if (node.nodeType === 3) {
        // node.nodeValue可能有插值表达式，需要通过replaceElementText
        // 这个方法去替换为data下的属性值
        var text = this.replaceElementText(node.nodeValue);
        newNode = document.createTextNode(text);
      }

      // 处理注释节点
      if (node.nodeType === 8) {
        return;
      }

      // 给newNode添加属性，属性来自虚拟节点的props
      Object.keys(node.props).forEach((v) => {
        // 相当于jq里面的attrs
        newNode.setAttribute(v, node.props[v]);
      });

      // 判断当前的节点是否是input元素，input元素中是否有v-model
      if (node.nodeName === "INPUT" && node.attrs["v-model"]) {
        // 把data的属性设置为该输入框的值
        newNode.value = this[node.attrs["v-model"].value]; // message

        // console.log(node.nodeName + "需要处理v-model指令")
        newNode.addEventListener("input", (event) => {
          // 获取输入框的值
          var inputValue = event.target.value;
          // 修改实例下面的某个属性，会触发set方法更新页面
          this[node.attrs["v-model"].value] = inputValue;
        });
      }

      // 把新的dom节点覆盖原来的dom节点
      node.node = newNode;

      parentNode.appendChild(newNode);

      if (node.children.length > 0) {
        // 判断如果有子元素，重新的执行该函数，函数也会相对应的变化
        this.createElementChild(newNode, node.children);
      }
    });
  }

  /**
   *  把节点的插值表达式内容替换为data的属性值
   */
  replaceElementText(value) {
    // 全局的正则表达式
    var reg = /\{\{[^\{\}]*\}\}/g;
    // 把带有两个大括号的数据返回一个数组
    var regArr = value.match(reg);

    // 如果是一个数组代表值里面有两个大括号
    if (Array.isArray(regArr)) {
      // 循环的替换value的值
      regArr.forEach((v) => {
        // 相当于把{{message}}两侧的大括号给删掉
        var prop = v.replace(/[\{\}]/g, "");
        // 相当于把{{message}}替换为data下面的属性值
        value = value.replace(v, this[prop]);
      });
    }

    return value;
  }

  /**
   * 监听数据变化后更新节点内容
   */
  updateElementText(key) {
    // key = message
    this.updateElementChild(this.$vmNodes, key);
  }

  /**
   * 递归调用更新子节点内容
   */
  updateElementChild(nodes, key) {
    nodes.forEach((node) => {
      // 判断当前的节点的data是否包含被修改的属性，如果有的话刷新当前的这个节点
      if (node.data.includes(key)) {
        // 修改dom节点的内容
        node.node.nodeValue = this.replaceElementText(node.nodeValue);
      }

      // 如果有子元素，递归查找子元素是否有key
      if (node.children.length > 0) {
        this.updateElementChild(node.children, key);
      }
    });
  }
}

// 浏览器环境
window.Vm = Vm;

// nodejs的开发环境
//  module.exports = Vm;
