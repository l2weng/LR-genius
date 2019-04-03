'use strict'

const React = require('react')
const { connect } = require('react-redux')
const { UserInfoContainer } = require('../components/user')
const { Tabs, Icon } = require('antd')
const TabPane = Tabs.TabPane
const { ProjectContainer } = require('../components/project')
const { Contacts } = require('../components/contacts')
const { Workplace } = require('../components/workplace')
const actions = require('../actions')
const { HEAD } = require('../constants')
const { userInfo } = ARGS
const _ = require('underscore')

const {
   func, string
} = require('prop-types')

class Header extends React.Component {

  state = { taskType: HEAD.MY_TASKS }

  constructor(props) {
    super(props)
  }

  componentDidMount() {
    // if (this.props.activeTab === undefined) {
    //   this.switchTab(HEAD.HOME)
    // }
  }

  switchTab = (tabName) => {
    if (tabName === HEAD.HOME) {
      if (!_.isEmpty(userInfo)) {
        this.props.reloadProjects(true, userInfo.user.userId)
        this.props.reloadTasks(userInfo.user.userId, this.state.taskType)
      }
    }
    this.props.switchTab(tabName)
  }

  switchTask = (taskTab) =>{
    this.setState({ taskType: taskTab })
  }

  render() {
    let { activeTab } = this.props
    return (
      <Tabs defaultActiveKey={activeTab} activeKey={activeTab} onChange={this.switchTab} style={{ height: '100%' }} tabBarExtraContent={<UserInfoContainer/>} >
        <TabPane tab={<span><Icon type="home" size="small"/>首页</span>} key={HEAD.HOME} className="tab-container">
          <Workplace switchTab={this.switchTab} switchTask={this.switchTask}/>
        </TabPane>
        <TabPane tab={<span><Icon type="project" size="small"/>项目</span>} key={HEAD.PROJECT} className="tab-container"><ProjectContainer showProject={false}/></TabPane>
        <TabPane tab={<span><Icon type="form" size="small"/>工作台</span>} key={HEAD.WORKSPACE} className="tab-container"><ProjectContainer showProject/></TabPane>
        <TabPane tab={<span><Icon type="contacts" size="small"/>联系人</span>}  key={HEAD.FRIENDS} className="tab-container"><Contacts/></TabPane>
      </Tabs>
    )
  }

  static propTypes = {
    activeTab: string,
    switchTab: func,
    reloadProjects: func,
    reloadTasks: func,
  }
}

module.exports = {
  Header: connect(
    state => ({
      activeTab: state.header.activeTab,
    }),
    dispatch => ({
      switchTab(tabName) {
        dispatch(actions.header.headerSwitch({ activeTab: tabName }))
      },
      reloadProjects(typeFlag = false, id) {
        dispatch(actions.header.loadProjects({ typeFlag, id }))
      },
      reloadTasks(userId, taskType) {
        dispatch(actions.header.loadMyTasks({ userId, type: taskType }))
      }
    }),
  )(Header),
}
