'use strict'

const React = require('react')
const { Component } = React
const { Modal, Table, Divider } = require('antd')
const { func, bool, array } = require('prop-types')
const { FormattedMessage, intlShape, injectIntl } = require('react-intl')
const moment = require('moment')
const { userInfo } = ARGS

class MessageBox extends Component {

  state = { userType: 0 };

  render() {
    const columns = [
      {
        title: this.props.intl.formatMessage({ id: 'message.title' }),
        dataIndex: 'title',
        key: 'title',
        render: (text, record) => (
          <FormattedMessage id={'contacts.invitation.title'}/>
        ),
      }, {
        title: this.props.intl.formatMessage({ id: 'message.type' }),
        dataIndex: 'type',
        key: 'type',
        render: (text, record) => (
          <FormattedMessage id={`message.type${record.type}`}/>
        ),
      }, {
        title: this.props.intl.formatMessage({ id: 'message.status' }),
        dataIndex: 'status',
        key: 'status',
        render: (text, record) => (
          <FormattedMessage id={`message.status${record.status}`}/>
        ),
      }, {
        title: this.props.intl.formatMessage({ id: 'message.created' }),
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (text, record) => (
          <span>{moment(record.createdAt).format('YYYY-MM-DD, HH:mm:ss')}</span>
        ),
      }, {
        title: this.props.intl.formatMessage({ id: 'message.invited' }),
        dataIndex: 'invited',
        key: 'invited'
      }, {
        title: this.props.intl.formatMessage({ id: 'message.action' }),
        key: 'action',
        render: (text, record) => (
          <span>
            {userInfo.user.userId !== record.createdBy ?
              <span>
                <a href="javascript:;"><FormattedMessage id="message.accept"/></a>
                <Divider type="vertical" />
                <a href="javascript:;"><FormattedMessage id="message.reject"/></a>
              </span>
              : ''
            }
          </span>
        ),
      }]
    return (
      <Modal
        destroyOnClose
        width={900}
        style={{ top: 20 }}
        title={<FormattedMessage id="message.head"/>}
        visible={this.props.modalVisible}
        footer={null}
        onCancel={() => this.props.handleModalVisible(false)} >
        <Table columns={columns} rowKey={record=>record.userId} dataSource={this.props.messages}
          expandedRowRender={record => <p style={{ margin: 0 }}>{record.createdByName} {this.props.intl.formatMessage({ id: 'contacts.invitation.content' })}</p>}/>
      </Modal>
    )
  }

  static propTypes = {
    intl: intlShape.isRequired,
    modalVisible: bool.isRequired,
    messages: array.isRequired,
    handleModalVisible: func.isRequired
  }
}

module.exports = {
  MessageBox: injectIntl(MessageBox)
}
