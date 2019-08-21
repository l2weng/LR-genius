'use strict'

const React = require('react')
const { PureComponent } = React
const { array, object, bool, func } = require('prop-types')
const { Table } = require('antd')
const moment = require('moment')
const { ACTIVITY } = require('../../constants')

const columns = [
  {
    title: '工作人员',
    dataIndex: 'userName',
    render: text => <a href="javascript:;">{text}</a>,
  }, {
    title: '角色',
    dataIndex: 'role',
    render: role => <div>{role === 0 ? '同事' : '好友'}</div>,
  }, {
    title: '类型',
    dataIndex: 'category',
    render: category => <div>{ACTIVITY.CATEGORY[category]}</div>,
  }, {
    title: '行为',
    dataIndex: 'type',
    render: type => <div>{ACTIVITY.EVENT[type]}</div>,
  }, {
    title: '图片名称',
    width: '20%',
    dataIndex: 'photoName',
  }, {
    title: '标注数',
    sorter: true,
    dataIndex: 'count',
  }, {
    title: '耗时',
    dataIndex: 'spendTime',
    render: spendTime=><div>{(spendTime / 1000).toFixed(2)}s</div>,
  }, {
    title: '完成日期',
    dataIndex: 'finishedTime',
    render: finishedTime=><div>{moment(new Date(finishedTime)).format('YYYY-MM-DD, HH:mm:ss')}</div>,
  }, {
    title: '操作',
    dataIndex: '',
    key: 'x',
    render: () => <a href="javascript:;">详情</a>,
  }]

class WorkLog extends PureComponent {

  static propTypes = {
    logData: array.isRequired,
    pagination: object.isRequired,
    loading: bool.isRequired,
    onChange: func.isRequired
  }

  constructor(props) {
    super(props)
    this.state = {}
  }

  render() {
    const { logData, pagination, loading, onChange } = this.props
    if (logData && logData.length > 0) {
      for (const oneLog of logData) {
        if (oneLog.children.length === 0) {
          delete oneLog['children']
        }
      }
    }
    console.log(logData)
    return (
      <div>
        <Table columns={columns} pagination={pagination} loading={loading}
          rowKey={record => `${record.activityId}-${record.labelId}`} dataSource={logData}
          onChange={onChange}/>
      </div>
    )
  }
}

module.exports = { WorkLog }
