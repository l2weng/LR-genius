'use strict'

const React = require('react')
const { PureComponent } = React
const { Row, Col, Tabs } = require('antd')
const TabPane = Tabs.TabPane
const { CoWorkers } = require('./coWorkers')
const { Colleague } = require('./colleague')
const { FormattedMessage } = require('react-intl')
const { userInfo } = ARGS
const { array } = require('prop-types')

class Contacts extends PureComponent {
  constructor(props) {
    super(props)
    this.state = {}
  }

  render() {
    const { coWorks } = this.props
    return (
      <div style={{ paddingTop: '20px', overflowX: 'hidden' }}>
        <Row gutter={24}>
          <Col span={24}>
            <Tabs style={{ textAlign: 'left' }}
              defaultActiveKey={userInfo.user.userType + ''}
              tabPosition="left">
              {userInfo.user.userType === 1 && <TabPane tab={<FormattedMessage id="contacts.colleague"/>} key="1">
                <Colleague/>
              </TabPane>}
              {/*<TabPane tab="人员分组" key="2">*/}
              {/*  <Teams/>*/}
              {/*</TabPane>*/}
              <TabPane tab={<FormattedMessage id="contacts.friend"/>} key="0">
                <CoWorkers coWorks={coWorks}/>
              </TabPane>
            </Tabs>
          </Col>
        </Row>
      </div>
    )
  }

  static propTypes = {
    coWorks: array.isRequired,
  }
}

module.exports = {
  Contacts
}
